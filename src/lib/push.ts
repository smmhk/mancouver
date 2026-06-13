import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export async function enablePushNotifications(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast.error("Push notifications not supported in this browser");
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast.message("Notifications dismissed", { description: "You can enable them later from your profile." });
      return false;
    }
    // Try to register subscription if a service worker is available; if not, just record the preference.
    let endpoint = `local-${userId}-${navigator.userAgent.slice(0, 60)}`;
    let p256dh: string | null = null;
    let auth: string | null = null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const j = sub.toJSON();
          endpoint = sub.endpoint;
          p256dh = j.keys?.p256dh ?? null;
          auth = j.keys?.auth ?? null;
        }
      }
    } catch {/* ignore */}
    await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint, p256dh, auth_key: auth, user_agent: navigator.userAgent },
      { onConflict: "user_id,endpoint" },
    );
    await supabase.from("profiles").update({ notifications_enabled: true }).eq("id", userId);
    toast.success("Notifications enabled");
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not enable notifications");
    return false;
  }
}
