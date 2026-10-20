/** Forja IA — tope de tamaño para lo que se manda a `/api/repos` con la
 * acción `buildFromFiles` (el proyecto entero, como JSON, en el cuerpo del
 * POST).
 *
 * Vercel rechaza el cuerpo de una función serverless por encima de ~4.5 MB
 * ANTES de que llegue a nuestro código — devuelve una respuesta de texto
 * plano («Request Entity Too Large»), no JSON, así que `res.json()` revienta
 * con un parseo fallido en vez de un error legible. Este tope se comprueba
 * en el CLIENTE, antes de mandar nada, para avisar claro en vez de dejar que
 * la petición reviente a mitad de camino. Compartido entre el cliente
 * (sandbox-studio.tsx, antes de mandar) y el servidor (route.ts, defensa
 * adicional por si algún día cambia cómo se llega hasta ahí).
 */
export const MAX_BUILD_UPLOAD_BYTES = 4 * 1024 * 1024;

/** `null` si el tamaño está bien; si no, el mensaje ya listo para mostrar. */
export function buildUploadSizeError(totalBytes: number): string | null {
  if (totalBytes <= MAX_BUILD_UPLOAD_BYTES) return null;
  return (
    `El proyecto pesa ${(totalBytes / (1024 * 1024)).toFixed(1)} MB de texto: supera el límite de ` +
    `${MAX_BUILD_UPLOAD_BYTES / (1024 * 1024)} MB que admite el cuerpo de una función serverless en Vercel ` +
    `para este tipo de acción. Sacá archivos que no hagan falta (carpetas de build previas, dependencias ` +
    `ya instaladas…) o probá con un proyecto más chico.`
  );
}

/** Parsea la respuesta de `/api/repos` (`build`/`buildFromFiles`).
 *
 * Por encima de MAX_BUILD_UPLOAD_BYTES, Vercel rechaza el cuerpo ANTES de
 * que llegue a nuestro código, con una respuesta de texto plano («Request
 * Entity Too Large»), no JSON — sin esta comprobación, `JSON.parse` revienta
 * con «Unexpected token…» en vez de decir qué pasó de verdad. Lanza en
 * cualquier caso de error (JSON inválido o `status` fuera de 2xx); solo
 * devuelve el cuerpo ya parseado cuando la petición salió bien. */
export function parseBuildResponse(status: number, bodyText: string): Record<string, unknown> {
  let parsed: Record<string, unknown>;
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      status === 413 || /request entity too large/i.test(bodyText)
        ? "El proyecto es demasiado grande para esta petición (límite de la plataforma, no del código). " +
          "Probá con un proyecto más chico."
        : `El servidor respondió algo que no es JSON (código ${status}): ${bodyText.slice(0, 200)}`
    );
  }
  const ok = status >= 200 && status < 300;
  if (!ok) throw new Error(String(parsed.error ?? `Error ${status}`));
  return parsed;
}
