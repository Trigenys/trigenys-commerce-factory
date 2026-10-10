import type { CSSProperties } from "react";
import { resolveStoreTheme, themeFonts } from "../../shared/store-themes";
import type { PublicStorefront } from "./types";

export function themeShellProps(store: Pick<PublicStorefront["store"], "theme" | "themeSettings">) {
  const theme = resolveStoreTheme(store.theme, store.themeSettings);
  const style = {
    "--shop-bg": theme.tokens.background,
    "--shop-card": theme.tokens.surface,
    "--shop-ink": theme.tokens.ink,
    "--shop-muted": theme.tokens.muted,
    "--shop-primary": theme.tokens.accent,
    "--shop-primary-hover": theme.tokens.accent,
    "--theme-on-accent": theme.onAccent,
    "--theme-scene": theme.tokens.scene,
    "--theme-scene-ink": theme.tokens.sceneInk,
    "--theme-scene-muted": theme.tokens.sceneMuted,
    "--theme-font": themeFonts[theme.font],
    "--theme-image-fit": theme.imageFit
  } as CSSProperties;
  return {
    className: "public-store-shell",
    "data-theme": theme.id,
    "data-layout": theme.layout,
    style
  };
}
