import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import heroImage from "@/assets/mancouver-hero-v3.jpg";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Welcome back — Mancouver" },
      { name: "description", content: "Log in to Mancouver. Find players, book courts, and organize your next rally in Vancouver." },
    ],
  }),
});

const NTRP = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5"];

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

const resetSchema = z.object({ email: z.string().trim().email() });

const REMEMBERED_EMAIL_KEY = "mancouver:remembered_email";

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const remembered = typeof window !== "undefined" ? window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "" : "";
    return { display_name: "", email: remembered, password: "", ntrp_rating: "2.5" };
  });
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    return !!window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
  });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  async function resendVerification(email: string) {
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/home` },
      });
      if (error) throw error;
      toast.success("Verification email sent. Please check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend verification email");
    } finally {
      setResendBusy(false);
    }
  }

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
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { display_name: parsed.data.display_name, ntrp_rating: parsed.data.ntrp_rating },
          },
        });
        if (error) throw error;
        setPendingVerifyEmail(parsed.data.email);
        toast.success("Please verify your email address to activate your account.");
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
        if (error) {
          if (/confirm|verif/i.test(error.message)) {
            setPendingVerifyEmail(parsed.data.email);
          }
          throw error;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email: forgotEmail });
    if (!parsed.success) {
      toast.error("Please enter a valid email");
      return;
    }
    setForgotBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Intentionally ignore — always show the same message
    } finally {
      setForgotBusy(false);
      setForgotOpen(false);
      setForgotEmail("");
      toast.success("If an account with that email address exists, a password reset link has been sent.");
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 flex items-start justify-center px-5 py-8">
        <div className="w-full max-w-md">
          {/* Hero */}
          <div className="mb-6 overflow-hidden rounded-3xl border border-border shadow-md bg-card">
            <img
              src={heroImage}
              alt="Mancouver — Find Your Next Rally"
              width={1536}
              height={1024}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            {mode === "login" ? (
              <div className="mb-5 text-center">
                <h1 className="font-display text-3xl text-foreground">Welcome Back</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Log in to continue to Mancouver
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Find players. Book courts. Organize your next rally.
                </p>
              </div>
            ) : (
              <div className="mb-5 text-center">
                <h1 className="font-display text-3xl text-foreground">Join Mancouver</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Join Vancouver's tennis community and organize your next match.
                </p>
              </div>
            )}

            {pendingVerifyEmail && (
              <div className="mb-4 rounded-2xl border border-border bg-cream p-4 text-sm">
                <p className="font-semibold text-foreground">Please verify your email address to activate your account.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We sent a verification link to <span className="font-medium text-foreground">{pendingVerifyEmail}</span>. You need to verify before signing in.
                </p>
                <Button
                  type="button"
                  onClick={() => resendVerification(pendingVerifyEmail)}
                  disabled={resendBusy}
                  variant="outline"
                  className="mt-3 h-9 rounded-xl text-xs font-semibold uppercase tracking-wider"
                >
                  {resendBusy ? "Sending..." : "Resend verification email"}
                </Button>
              </div>
            )}



            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</Label>
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="Mandy"
                    maxLength={60}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email Address</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(form.email); setForgotOpen(true); }}
                      className="text-[11px] font-medium text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                    >
                      Forgot your password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
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
                className="w-full bg-brand text-white hover:bg-brand-dark font-bold uppercase tracking-wider rounded-xl h-12"
              >
                {busy ? "..." : mode === "signup" ? "Create Account" : "Log In"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    Create Account
                  </button>
                </>
              ) : (
                <>
                  Already a member?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    Log In
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-10 space-y-8">
            <section>
              <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-4">
                What you can do
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: "🎾", title: "Find Players", body: "Connect with local tennis players." },
                  { icon: "📍", title: "Book Courts", body: "Discover and reserve courts." },
                  { icon: "📅", title: "Organize Matches", body: "Easily schedule your next rally." },
                ].map((f) => (
                  <div key={f.title} className="bg-card border border-border rounded-2xl p-4 text-center">
                    <div className="text-2xl">{f.icon}</div>
                    <div className="mt-2 font-semibold text-sm text-foreground">{f.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{f.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-4">
                Built on trust
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: "🔒", title: "Safe & Secure", body: "Your account and data are protected." },
                  { icon: "🤝", title: "Community First", body: "Built for Vancouver tennis players." },
                  { icon: "🌲", title: "Vancouver Proud", body: "Supporting local courts and tennis communities." },
                ].map((f) => (
                  <div key={f.title} className="bg-cream border border-border rounded-2xl p-4 text-center">
                    <div className="text-2xl">{f.icon}</div>
                    <div className="mt-2 font-semibold text-sm text-foreground">{f.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{f.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <nav className="pt-6 border-t border-border">
              <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {["About", "Courts", "Community", "Support", "Privacy Policy", "Terms of Service"].map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-brand">{l}</a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                © {new Date().getFullYear()} Mancouver · Find Your Next Rally
              </p>
            </nav>
          </footer>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email and we'll send you a secure link to set a new password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={forgotBusy}
                className="w-full bg-brand text-white hover:bg-brand-dark font-bold uppercase tracking-wider rounded-xl h-11"
              >
                {forgotBusy ? "Sending..." : "Send Reset Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
