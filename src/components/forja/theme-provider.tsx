"use client";
/** Forja IA — Proveedor de tema */
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/** Colores de la barra del navegador; los mismos que `viewport.themeColor`. */
const THEME_COLOR = { dark: "#07070C", light: "#F7F7FB" } as const;

/** `viewport.themeColor` solo sabe del tema del SISTEMA. Si eliges «Oscuro»
 * con el dispositivo en claro, la barra del navegador quedaba clara sobre
 * una app oscura: aquí las dos metas pasan a decir el tema que se ve. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "dark" && resolvedTheme !== "light") return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_COLOR[resolvedTheme];
    }
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      /* Por defecto se sigue al sistema: el oscuro forzado dejaba la app a
         contramano de quien tiene el dispositivo en claro. */
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
