"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Camera } from "lucide-react";
import { toast } from "sonner";

interface Labels {
  accountInfo: string;
  accountDesc: string;
  email: string;
  username: string;
  currentPassword: string;
  newPassword: string;
  changeName: string;
  changePassword: string;
  saving: string;
  saved: string;
  namePlaceholder: string;
  nameRequired: string;
  passwordRequired: string;
  passwordMinLength: string;
  wrongPassword: string;
  updateError: string;
}

interface ProfileEditCardProps {
  email: string;
  currentName: string;
  currentImage: string | null;
  labels: Labels;
}

export function ProfileEditCard({ email, currentName, currentImage, labels }: ProfileEditCardProps) {
  const [name, setName] = useState(currentName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatar, setAvatar] = useState(currentImage);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError(labels.nameRequired);
      return;
    }
    setNameSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setNameSaved(true);
        toast.success(labels.saved);
        setTimeout(() => setNameSaved(false), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || labels.updateError);
      }
    } catch {
      setError(labels.updateError);
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!currentPassword || !newPassword) {
      setError(labels.passwordRequired);
      return;
    }
    if (newPassword.length < 6) {
      setError(labels.passwordMinLength);
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwSaved(true);
        toast.success(labels.saved);
        setCurrentPassword("");
        setNewPassword("");
        setTimeout(() => setPwSaved(false), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || labels.updateError);
      }
    } catch {
      setError(labels.updateError);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error("Please select an image under 5MB");
      return;
    }

    setAvatarUploading(true);
    try {
      // 1. Get upload URL
      const urlRes = await fetch(
        `/api/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`
      );
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const config = await urlRes.json();

      // 2. Upload to S3
      if (config.uploadUrl) {
        await fetch(config.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
      }

      // 3. Save image URL to profile
      const imgUrl = config.publicUrl || config.uploadUrl;
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imgUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        setAvatar(data.user.image);
        toast.success(labels.saved);
      } else {
        throw new Error("Failed to save avatar");
      }
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.accountInfo}</CardTitle>
        <CardDescription>{labels.accountDesc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative group cursor-pointer rounded-full"
          >
            <Avatar className="w-16 h-16 ring-2 ring-zinc-100 dark:ring-zinc-700 group-hover:ring-brand-500 transition-all">
              {avatar ? (
                <AvatarImage src={avatar} alt={currentName || ""} />
              ) : null}
              <AvatarFallback className="text-xl font-semibold bg-brand-900 text-white dark:bg-brand-700">
                {currentName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading ? (
                <Loader2 size={20} className="animate-spin text-white" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </div>
          </button>
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {currentName || "User"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Click to upload · JPEG, PNG · Max 5MB
            </p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Email (read-only) */}
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-sm text-muted-foreground">{labels.email}</span>
          <span className="text-sm font-medium">{email || "-"}</span>
        </div>

        {/* Name */}
        <form onSubmit={handleNameSubmit} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block mb-1.5 text-sm text-muted-foreground">{labels.username}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.namePlaceholder}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-700/10 transition-colors"
            />
          </div>
          <Button type="submit" disabled={nameSaving} size="sm" className="cursor-pointer h-9">
            {nameSaving ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : nameSaved ? (
              <Check size={14} className="mr-1" />
            ) : null}
            {nameSaved ? labels.saved : nameSaving ? labels.saving : labels.changeName}
          </Button>
        </form>

        {/* Change Password */}
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3 pt-2 border-t border-border">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{labels.changePassword}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 text-xs text-muted-foreground">{labels.currentPassword}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-700/10 transition-colors"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs text-muted-foreground">{labels.newPassword}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-brand-700 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-700/10 transition-colors"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pwSaving} size="sm" variant="outline" className="cursor-pointer h-9">
              {pwSaving ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : pwSaved ? (
                <Check size={14} className="mr-1" />
              ) : null}
              {pwSaved ? labels.saved : pwSaving ? labels.saving : labels.changePassword}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
