"use client";
/** Forja IA — Al abrir la APK: arrancar el último modelo y mirar si hay versión nueva.
 *
 * El motor nativo vive mientras vive la app: al volver a abrirla hay que
 * cargarlo otra vez. Se hace solo con el último modelo usado, para que el
 * primer mensaje no falle por un motor parado. Y si hay una APK nueva en las
 * releases del repo, se ofrece instalarla sin salir de aquí.
 *
 * Fuera de la APK no hace nada. */
import { useEffect } from "react";
import { toast } from "sonner";
import { escucharAndroid, estadoOpenCodeNativo, leerJson, puenteAndroid, type EstadoMotor, type ModeloNativo } from "@/lib/forja/plataforma";
import { aplicarMotorListo, useNativoAjustes } from "@/lib/forja/nativo";
import { aplicarOpenCodeListo } from "@/lib/forja/opencode-nativo";

export function ApkArranque() {
  useEffect(() => {
    const puente = puenteAndroid();
    if (!puente) return;

    const quitar = escucharAndroid((e) => {
      if (e.tipo === "motor") {
        if (e.estado.estado === "listo") aplicarMotorListo(e.estado);
        if (e.estado.estado === "error") {
          toast.error("El motor nativo no arrancó", {
            description: e.estado.detalle ?? "Mira Ajustes → Proveedores → Modelo nativo.",
            duration: 10000,
          });
        }
      }
      if (e.tipo === "opencode") {
        if (e.estado.estado === "listo") {
          void aplicarOpenCodeListo(e.estado).then((modelos) => {
            if (modelos.length) {
              toast.success("Motor OpenCode listo", {
                description: `${modelos.length} modelos gratis, sin clave de API. Ya puedes elegirlos en el selector.`,
                duration: 8000,
              });
            }
          });
        }
        if (e.estado.estado === "error") {
          toast.error("El motor OpenCode no arrancó", {
            description: e.estado.mensaje ?? "Mira Ajustes → Proveedores → OpenCode.",
            duration: 10000,
          });
        }
      }
      if (e.tipo === "actualizacion" && e.disponible) {
        toast.info(`Forja ${e.version ?? ""} disponible`, {
          description: e.notas ?? "Se descarga e instala sin salir de la app.",
          duration: 20000,
          action: { label: "Actualizar", onClick: () => puente.instalarActualizacion() },
        });
      }
      if (e.tipo === "descarga" && e.error) {
        toast.error("No se pudo descargar la actualización", { description: e.error });
      }
    });

    // Arrancar el último modelo, si sigue ahí y el motor está parado. Hay
    // que esperar a la primera foto del lado nativo: antes no se sabe nada.
    let vivo = true;
    void (puente.listo ?? Promise.resolve()).then(() => {
      if (!vivo) return;
      // El motor OpenCode arranca solo si ya está instalado (lo hace el lado
      // nativo); si ya estaba listo cuando abrió la interfaz, se aplica ahora.
      const oc = estadoOpenCodeNativo();
      if (oc?.estado === "listo") void aplicarOpenCodeListo(oc);
      const motor = leerJson<EstadoMotor | null>(puente.estadoMotor(), null);
      if (motor?.estado === "listo") {
        aplicarMotorListo(motor);
      } else if (motor?.estado !== "cargando") {
        const { modelo, contexto, hilos } = useNativoAjustes.getState();
        const hay = leerJson<ModeloNativo[]>(puente.modelos(), []).some((m) => m.nombre === modelo);
        if (modelo && hay) puente.iniciar(modelo, contexto, hilos);
      }
    });

    // Y la actualización, un momento después para no competir con la carga.
    const t = setTimeout(() => puente.buscarActualizacion(), 4000);
    return () => {
      vivo = false;
      clearTimeout(t);
      quitar();
    };
  }, []);
  return null;
}
