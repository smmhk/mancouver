import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
} | null | undefined;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  profile: Profile;
  avatarPreviewUrl: string | null;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
  user,
  profile,
  avatarPreviewUrl,
}: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // Reset state every time dialog opens (discard unsaved changes)
  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name ?? "");
      setPassword("");
      setShowPassword(false);
      setPendingFile(null);
      setPendingPreview(null);
    }
  }, [open, profile?.display_name]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { display_name?: string; avatar_url?: string } = {};

      // Avatar upload first
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) throw upErr;
        updates.avatar_url = path;
      }

      const trimmedName = displayName.trim();
      if (trimmedName && trimmedName !== profile?.display_name) {
        updates.display_name = trimmedName;
      }

      if (Object.keys(updates).length > 0) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id);
        if (pErr) throw pErr;
      }

      if (password) {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        const { error: passErr } = await supabase.auth.updateUser({ password });
        if (passErr) throw passErr;
      }
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["avatar", user.id] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update profile");
    },
  });

  const previewSrc = pendingPreview ?? avatarPreviewUrl;
  const initials = (profile?.display_name ?? user.email ?? "??")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>Update your profile. Changes save when you click Save.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Profile image */}
          <section className="flex items-center gap-4">
            <div className="size-20 rounded-full bg-brand/10 border border-brand/20 grid place-items-center overflow-hidden">
              {previewSrc ? (
                <img src={previewSrc} alt="Avatar preview" className="size-full object-cover" />
              ) : (
                <span className="text-brand font-bold text-lg">{initials}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1">Profile picture</p>
              <p className="text-xs text-muted-foreground mb-2">JPG or PNG, up to 5 MB.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5 mr-2" />
                {pendingFile ? "Change" : "Upload"}
              </Button>
            </div>
          </section>

          <Separator />

          {/* Profile info */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Profile Info
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email ?? ""}
                readOnly
                disabled
                className="opacity-70 cursor-not-allowed"
              />
            </div>
          </section>

          <Separator />

          {/* Security */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Security
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave blank to keep your current password. For security, your existing
                password cannot be displayed.
              </p>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
