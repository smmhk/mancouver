import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[] | null;
};

// The @supabase/supabase-js auth.oauth namespace is beta; type the three methods locally.
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthClient = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthClient(): OAuthClient {
  return (supabase.auth as unknown as { oauth: OAuthClient }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthClient().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md bg-card border border-border rounded-2xl p-6">
        <h1 className="font-display text-xl mb-2">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const client = oauthClient();
    const { data, error } = approve
      ? await client.approveAuthorization(authorization_id)
      : await client.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-sm">
        <h1 className="font-display text-2xl text-foreground mb-2">
          Connect {clientName} to Mancouver
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          This lets {clientName} use Mancouver as you — read courts, list your sessions,
          and book, join, or leave sessions on your behalf. Your Mancouver permissions still apply.
        </p>

        {details?.client?.redirect_uri && (
          <p className="text-xs text-muted-foreground mb-4 break-all">
            Redirect: <span className="font-mono">{details.client.redirect_uri}</span>
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 bg-brand text-white hover:bg-brand-dark font-bold uppercase tracking-wider rounded-xl h-11"
          >
            {busy ? "..." : "Approve"}
          </Button>
          <Button
            onClick={() => decide(false)}
            disabled={busy}
            variant="outline"
            className="flex-1 rounded-xl h-11"
          >
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}
