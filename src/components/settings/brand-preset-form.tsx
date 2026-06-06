"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface BrandPreset {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: string[] | null;
  fonts: { heading?: string; body?: string } | null;
}

interface BrandPresetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  preset?: BrandPreset | null;
  labels: {
    title: string;
    desc: string;
    namePlaceholder: string;
    logoLabel: string;
    colorsLabel: string;
    saveBtn: string;
    saving: string;
  };
}

const DEFAULT_COLORS = ["#1a1a2e", "#e94560", "#0f3460"];

export function BrandPresetForm({
  open,
  onOpenChange,
  onSaved,
  preset,
  labels,
}: BrandPresetFormProps) {
  const { t } = useT();
  const [name, setName] = useState(preset?.name ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(preset?.logoUrl ?? null);
  const [colors, setColors] = useState<string[]>(
    (preset?.colors as string[])?.length ? (preset?.colors as string[]) : [...DEFAULT_COLORS]
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-url", { method: "POST", body: formData });
      if (!res.ok) throw new Error(t("error.uploadFailed"));
      const data = await res.json();
      setLogoUrl(data.publicUrl);
    } catch {
      setError(t("error.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("settings.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("colors", JSON.stringify(colors));
      if (logoUrl) formData.append("logoUrl", logoUrl);

      const url = preset
        ? `/api/brand-presets/${preset.id}`
        : "/api/brand-presets";
      const method = preset ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("error.createFailed"));
      }
      onSaved();
      onOpenChange(false);
      if (!preset) {
        setName("");
        setLogoUrl(null);
        setColors([...DEFAULT_COLORS]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleAddColor() {
    if (colors.length < 5) setColors([...colors, "#888888"]);
  }

  function handleRemoveColor(index: number) {
    if (colors.length > 1) setColors(colors.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.desc}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Name */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.namePlaceholder}
              className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Logo */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">{labels.logoLabel}</p>
            {logoUrl ? (
              <div className="relative inline-flex">
                <img
                  src={logoUrl}
                  alt="Brand logo"
                  className="w-16 h-16 rounded-lg object-cover border border-zinc-200"
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-700 text-white flex items-center justify-center hover:bg-zinc-900 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "w-16 h-16 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center hover:border-zinc-300 hover:bg-zinc-50 transition-colors",
                  uploading && "opacity-50"
                )}
              >
                {uploading ? (
                  <Loader2 size={18} className="animate-spin text-zinc-400" />
                ) : (
                  <Upload size={18} className="text-zinc-300" />
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Colors */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">{labels.colorsLabel}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {colors.map((color, i) => (
                <div key={i} className="relative group">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const next = [...colors];
                      next[i] = e.target.value;
                      setColors(next);
                    }}
                    className="w-8 h-8 rounded-lg border border-zinc-200 cursor-pointer p-0.5"
                  />
                  {colors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(i)}
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-zinc-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  )}
                </div>
              ))}
              {colors.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddColor}
                  className="w-8 h-8 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center hover:border-zinc-300 transition-colors"
                >
                  <Plus size={14} className="text-zinc-400" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full bg-brand-900 hover:bg-brand-800 text-white cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1.5" />
                {labels.saving}
              </>
            ) : (
              labels.saveBtn
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
