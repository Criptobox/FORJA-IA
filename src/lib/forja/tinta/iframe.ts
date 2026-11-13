"use client";
/** FORJA IA — El iframe del motor Tinta (solo navegador).
 *
 * Se crea una vez, la primera vez que se usa, colgado del <body>: invisible
 * mientras dibuja (pero con su tamaño real, porque Tinta mide el contraste con
 * el DOM) y a pantalla completa mientras trabaja el equipo de agentes, que es
 * lo único que enseña. Solo acepta mensajes de ese iframe y del mismo origen. */
import { crearClienteTinta, type CanalTinta, type ClienteTinta } from "./cliente";
import { TINTA_ESTILOS_VERSION } from "./version";

/** La versión va en la dirección para que una copia nueva no se sirva desde caché. */
export const RUTA_MOTOR = `/tinta/motor.html?motor=1&v=${TINTA_ESTILOS_VERSION}`;

let actual: { cliente: ClienteTinta; mostrar: (si: boolean) => void } | null = null;

const OCULTO = "position:fixed;inset:0;width:100vw;height:100dvh;border:0;z-index:2147483000;opacity:0;pointer-events:none;background:transparent";
const VISIBLE = "position:fixed;inset:0;width:100vw;height:100dvh;border:0;z-index:2147483000;opacity:1;pointer-events:auto;background:transparent";

export function motorTinta(): { cliente: ClienteTinta; mostrar: (si: boolean) => void } {
  if (actual) return actual;
  const marco = document.createElement("iframe");
  marco.src = RUTA_MOTOR;
  marco.title = "Motor de diseño Tinta";
  marco.setAttribute("aria-hidden", "true");
  marco.tabIndex = -1;
  marco.style.cssText = OCULTO;
  document.body.appendChild(marco);
  const canal: CanalTinta = {
    enviar: (m) => marco.contentWindow?.postMessage(m, window.location.origin),
    escuchar: (f) => {
      const h = (ev: MessageEvent) => {
        if (ev.source !== marco.contentWindow || ev.origin !== window.location.origin) return;
        f(ev.data);
      };
      window.addEventListener("message", h);
      return () => window.removeEventListener("message", h);
    },
  };
  const cliente = crearClienteTinta(canal);
  const mostrar = (si: boolean) => {
    marco.style.cssText = si ? VISIBLE : OCULTO;
    if (si) marco.removeAttribute("aria-hidden");
    else marco.setAttribute("aria-hidden", "true");
    marco.tabIndex = si ? 0 : -1;
    if (si) marco.focus();
  };
  actual = { cliente, mostrar };
  return actual;
}
