import { useEffect, useState } from "react";

const KEY = "mancouver-guest-mode";
const EVENT = "mancouver-guest-mode-change";

export function isGuestModeOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuestMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — guest mode simply won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Hydration-safe read of guest mode (false on the server / first render). */
export function useGuestMode(): boolean {
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    const sync = () => setGuest(isGuestModeOn());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return guest;
}

export const GUEST_PROMPT =
  "You're currently browsing Mancouver as a guest. Sign up to create or join tennis sessions and start playing!";
