"use client";

import { useState, useEffect } from "react";
import { Shield, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandPresetForm } from "./brand-preset-form";

interface BrandPreset {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: string[] | null;
  fonts: { heading?: string; body?: string } | null;
}

interface BrandPresetsCardProps {
  userId: string;
  labels: {
    title: string;
    desc: string;
    noBrands: string;
    noBrandsDesc: string;
    createBtn: string;
    editBtn: string;
    deleteBtn: string;
    formTitle: string;
    formDesc: string;
    formEditTitle: string;
    formEditDesc: string;
    namePlaceholder: string;
    logoLabel: string;
    colorsLabel: string;
    saveBtn: string;
    saving: string;
  };
}

export function BrandPresetsCard({ userId, labels }: BrandPresetsCardProps) {
  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<BrandPreset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchPresets() {
    try {
      const res = await fetch("/api/brand-presets");
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets ?? []);
      }
    } catch { toast.error("Failed to load brand presets"); }
    setLoading(false);
  }

  useEffect(() => {
    fetchPresets();
  }, []);

  async function handleDelete(id: string) {
    setDeleteId(id);
    try {
      await fetch(`/api/brand-presets/${id}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch { toast.error("Failed to delete brand preset"); }
    setDeleteId(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>{labels.desc}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPreset(null);
                setFormOpen(true);
              }}
              className="gap-1 cursor-pointer"
            >
              <Plus size={14} />
              {labels.createBtn}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            </div>
          ) : presets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Shield size={32} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{labels.noBrands}</p>
                <p className="text-xs text-muted-foreground mt-1">{labels.noBrandsDesc}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {preset.logoUrl ? (
                      <img
                        src={preset.logoUrl}
                        alt={preset.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-xs font-medium text-zinc-400"
                        style={{ background: "var(--muted)" }}
                      >
                        {preset.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-medium">{preset.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {((preset.colors as string[]) || []).slice(0, 3).map((color: string) => (
                      <span
                        key={color}
                        className="inline-flex w-3 h-3 rounded-full border border-border"
                        style={{ background: color }}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPreset(preset);
                        setFormOpen(true);
                      }}
                      className="ml-2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                      title={labels.editBtn}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(preset.id)}
                      disabled={deleteId === preset.id}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400"
                      title={labels.deleteBtn}
                    >
                      {deleteId === preset.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BrandPresetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={fetchPresets}
        preset={editingPreset}
        labels={{
          title: editingPreset ? labels.formEditTitle : labels.formTitle,
          desc: editingPreset ? labels.formEditDesc : labels.formDesc,
          namePlaceholder: labels.namePlaceholder,
          logoLabel: labels.logoLabel,
          colorsLabel: labels.colorsLabel,
          saveBtn: labels.saveBtn,
          saving: labels.saving,
        }}
      />
    </>
  );
}
