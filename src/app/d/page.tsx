"use client";
/** Forja IA — Monta un sitio desplegado desde el Sandbox (ver
 * src/lib/forja/static-deploy.ts): el sitio entero viaja comprimido en el
 * fragmento de esta misma URL («#…»), un fragmento nunca llega a ningún
 * servidor. Esta página no llama a nada: decodifica el fragmento en el
 * propio navegador y lo corre en un iframe aislado, igual que la vista
 * previa del Sandbox. */
import { useEffect, useState } from "react";
import { decodeDeploy } from "@/lib/forja/static-deploy";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "vacio" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; html: string };

export default function DeployPage() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    const fragmento = window.location.hash.slice(1);
    if (!fragmento) {
      setEstado({ tipo: "vacio" });
      return;
    }
    let cancelado = false;
    decodeDeploy(fragmento)
      .then((html) => {
        if (!cancelado) setEstado({ tipo: "listo", html });
      })
      .catch(() => {
        if (!cancelado) {
          setEstado({
            tipo: "error",
            mensaje: "El enlace está incompleto o dañado: falta parte de lo que va después de «#».",
          });
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.tipo === "listo") {
    return (
      <iframe
        title="Sitio desplegado con Forja IA"
        srcDoc={estado.html}
        sandbox="allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock"
        className="fixed inset-0 h-full w-full border-0 bg-white"
      />
    );
  }

  const mensaje =
    estado.tipo === "cargando"
      ? "Cargando…"
      : estado.tipo === "vacio"
        ? "Este enlace no trae ningún sitio. Desplegá un proyecto desde el Sandbox de Forja IA para generar uno."
        : estado.mensaje;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      {mensaje}
    </div>
  );
}
