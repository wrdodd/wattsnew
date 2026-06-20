export const FONT_SIZES: Record<string, string> = {
  comfortable: "100%",
  large: "112.5%",
  xlarge: "125%",
};

/** Apply the configured accent color + reading size to the document. */
export function applyTheme(theme: { accent?: string; fontScale?: string }) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  if (theme.accent) {
    r.style.setProperty("--primary", theme.accent);
    r.style.setProperty("--accent", theme.accent);
    r.style.setProperty("--sidebar-primary", theme.accent);
  }
  r.style.fontSize = FONT_SIZES[theme.fontScale ?? "comfortable"] ?? "100%";
}
