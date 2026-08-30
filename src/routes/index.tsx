import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useGuestMode } from "@/lib/guest-mode";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface">
        <div className="size-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }
  return <Navigate to={session ? "/home" : "/auth"} replace />;
}
