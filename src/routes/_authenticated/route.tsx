import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface">
        <div className="size-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
