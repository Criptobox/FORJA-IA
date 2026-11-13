/** FORJA IA — Del resultado de Tinta a un proyecto del Estudio.
 *
 * La app de Tinta es UN HTML con todas sus pantallas enlazadas por la barra
 * inferior, así que entra como una sola pantalla del proyecto («App completa»)
 * con su versión. Viaja también `tinta-proyecto.json` (el borrador): al
 * exportar o subir a GitHub va con la app y se puede reabrir en Estilos. */
import { actualizarPantalla, agregarPantallas, conNuevaVersion } from "../estudio/proyecto";
import type { ProyectoDiseno } from "../estudio/tipos";
import type { ResultadoTinta } from "./crear";

export const NOMBRE_PANTALLA_TINTA = "App completa (Tinta)";

export function conAppTinta(p: ProyectoDiseno, r: ResultadoTinta, pedido: string, ahora = Date.now()): ProyectoDiseno {
  const nombres = r.pantallas.map((s) => s.nombre).join(", ");
  const conPantalla = agregarPantallas(p, [{ nombre: NOMBRE_PANTALLA_TINTA, proposito: `App de ${r.pantallas.length} pantallas: ${nombres}` }]);
  const nueva = conPantalla.pantallas[conPantalla.pantallas.length - 1];
  return actualizarPantalla(conPantalla, nueva.id, (s) =>
    conNuevaVersion(
      s,
      {
        pedido: pedido.trim().slice(0, 500),
        archivos: [
          { path: "index.html", text: r.html },
          { path: "tinta-proyecto.json", text: JSON.stringify({ format: "estilos-tinta-project", version: 1, name: p.nombre, draft: r.borrador }, null, 2) },
        ],
        entrada: "index.html",
        modelo: r.modelKey,
      },
      ahora
    )
  );
}
