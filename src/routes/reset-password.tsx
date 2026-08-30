import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password — Mancouver" },
      { name: "description", content: "Set a new password for your Mancouver account." },
    ],
  }),
});

const schema = z
  .object({
    password: z.string().min(6, "At least 6 characters").max(72),
    confirm: z.string().min(1),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a temporary session via URL fragment.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Your password has been successfully updated. Please log in with your new password.");
      navigate({ to: "/auth", search: { next: undefined, mode: undefined }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="mb-5 text-center">
          <h1 className="font-display text-3xl text-foreground">Set a New Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a password with at least 6 characters.
          </p>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Verifying your reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">New Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-brand text-white hover:bg-brand-dark font-bold uppercase tracking-wider rounded-xl h-12"
            >
              {busy ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
