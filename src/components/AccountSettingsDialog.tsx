import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NTRP_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  ntrp_rating: number | null;
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
  const [ntrp, setNtrp] = useState<string>(
    profile?.ntrp_rating != null ? String(profile.ntrp_rating.toFixed(1)) : "",
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // Reset state every time dialog opens (discard unsaved changes)
  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name ?? "");
      setNtrp(profile?.ntrp_rating != null ? profile.ntrp_rating.toFixed(1) : "");
      setPendingFile(null);
      setPendingPreview(null);
    }
  }, [open, profile?.display_name, profile?.ntrp_rating]);

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
      const trimmedName = displayName.trim();
      if (!trimmedName) throw new Error("Display name cannot be empty");

      const updates: { display_name?: string; avatar_url?: string; ntrp_rating?: number } = {};

      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) throw upErr;
        updates.avatar_url = path;
      }

      if (trimmedName !== profile?.display_name) {
        updates.display_name = trimmedName;
      }

      const ntrpNum = ntrp ? Number(ntrp) : null;
      if (ntrpNum !== profile?.ntrp_rating) {
        if (ntrpNum == null) throw new Error("Please select an NTRP rating");
        updates.ntrp_rating = ntrpNum;
      }

      if (Object.keys(updates).length === 0) return;

      const { error: pErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (pErr) throw pErr;
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

          {/* NTRP rating */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              NTRP Rating
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ntrp">Skill level</Label>
              <Select value={ntrp} onValueChange={setNtrp}>
                <SelectTrigger id="ntrp">
                  <SelectValue placeholder="Select your NTRP rating" />
                </SelectTrigger>
                <SelectContent>
                  {NTRP_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Reset or update your self-rated NTRP level. Saved when you click Save.
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
