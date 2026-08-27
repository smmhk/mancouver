// Resilient "Remember me" preference storage.
// localStorage can throw (Safari private mode, blocked storage in embedded
// browsers like the in-app WhatsApp/KakaoTalk webviews), so every access is
// guarded and falls back to a long-lived first-party cookie.

const EMAIL_KEY = "mancouver:remembered_email";
const FLAG_KEY = "mancouver:remember_me";
const ONE_YEAR = 60 * 60 * 24 * 365;

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — cookie fallback handles it */
  }
}

function cookieGet(key: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function cookieSet(key: string, value: string | null) {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    if (value === null) {
      document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    } else {
      document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
    }
  } catch {
    /* cookies blocked */
  }
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return lsGet(key) ?? cookieGet(key);
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  lsSet(key, value);
  cookieSet(key, value);
}

export type RememberedLogin = { email: string; remember: boolean };

/** Read on the client only (never during SSR/hydration). */
export function readRememberedLogin(): RememberedLogin {
  const email = read(EMAIL_KEY) ?? "";
  const flag = read(FLAG_KEY);
  // Legacy state: email stored without an explicit flag means "remember" was on.
  const remember = flag === null ? email !== "" : flag === "1";
  return { email: remember ? email : "", remember };
}

export function saveRememberedLogin(email: string) {
  write(EMAIL_KEY, email);
  write(FLAG_KEY, "1");
}

export function clearRememberedLogin() {
  write(EMAIL_KEY, null);
  write(FLAG_KEY, "0");
}
