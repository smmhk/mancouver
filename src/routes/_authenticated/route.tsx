import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useGuestMode, isGuestModeOn } from "@/lib/guest-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  // Guests may browse the app read-only; every write action is gated in the UI.
  const guest = useGuestMode();
  if (!session && (guest || isGuestModeOn())) return <Outlet />;
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface">
        <div className="size-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!session) {
    const next =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
    return <Navigate to="/auth" search={{ next, mode: undefined }} replace />;
  }
  return <Outlet />;
}
