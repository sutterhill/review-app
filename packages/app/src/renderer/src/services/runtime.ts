export const isDesktopRuntime = (): boolean =>
  typeof window !== "undefined" && !!window.reviewAppAuth;

export const getRuntimeLabel = (): "desktop" | "web" => (isDesktopRuntime() ? "desktop" : "web");

export const readLocalJson = <Value>(key: string, fallback: Value): Value => {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as Value;
  } catch {
    return fallback;
  }
};

export const writeLocalJson = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};
