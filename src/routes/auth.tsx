import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Baseline YVR" },
      { name: "description", content: "Sign in to join the Vancouver tennis community." },
    ],
  }),
});

const NTRP = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0+"];

const signupSchema = z.object({
  display_name: z.string().trim().min(1, "Name required").max(60),
  email: z.string().trim().email().max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  ntrp_rating: z.string().min(1, "Pick your NTRP"),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", password: "", ntrp_rating: "3.0" });

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          return;
        }
        const ntrpNum = parsed.data.ntrp_rating === "5.0+" ? "5.0" : parsed.data.ntrp_rating;
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { display_name: parsed.data.display_name, ntrp_rating: ntrpNum },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to the court.");
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/home` });
      if (result.error) toast.error("Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
          <div className="text-4xl mb-2">🎾</div>
          <h1 className="text-3xl font-extrabold italic uppercase tracking-tighter">
            Mancouver
          </h1>
          <p className="text-sm mt-1 text-brand font-semibold tracking-tight">
            Find Your Next Rally
          </p>
          <p className="text-[11px] mt-2 text-muted-foreground">
            Join Vancouver's tennis community and easily organize your next match.
          </p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex gap-2 mb-6 p-1 bg-background rounded-xl">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    mode === m ? "bg-brand text-brand-foreground text-black" : "text-muted-foreground"
                  }`}
                >
                  {m === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</Label>
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="Marcus Chen"
                    maxLength={60}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">NTRP Rating</Label>
                  <Select value={form.ntrp_rating} onValueChange={(v) => setForm({ ...form, ntrp_rating: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NTRP.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-brand text-black hover:bg-brand-dark font-bold uppercase tracking-wider rounded-xl h-12"
              >
                {busy ? "..." : mode === "signup" ? "Create account" : "Log in"}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-card px-3 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full h-12 rounded-xl border-border bg-background hover:bg-background/60 font-semibold"
            >
              Continue with Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
