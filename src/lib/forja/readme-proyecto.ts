/** Forja IA — README del ZIP descargado.
 *
 * Un proyecto que se descarga tiene que poder abrirse y editarse sin saber cómo
 * lo hizo Forja: qué es cada archivo, cómo verlo en el ordenador y cómo
 * publicarlo. Si la IA ya escribió su propio README.md, no se toca. */

const NOTAS: Record<string, string> = {
  "index.html": "la página de entrada",
  "styles.css": "los estilos (los colores y medidas están arriba, en variables)",
  "js/app.js": "arranca la app y conecta las pantallas",
  "js/store.js": "los datos y su guardado en el navegador",
  "js/router.js": "las rutas de cada pantalla",
  "manifest.webmanifest": "permite instalarla como app",
  "icon.svg": "el icono",
};

export function readmeDelProyecto(titulo: string | null | undefined, paths: readonly string[]): string {
  const nombre = (titulo ?? "").trim() || "Mi proyecto";
  const usaModulos = paths.some((p) => /\.js$/.test(p)) && paths.some((p) => /index\.html$/i.test(p));
  const lista = [...paths]
    .sort()
    .map((p) => {
      const nota = NOTAS[p] ?? (p.startsWith("js/views/") ? "una pantalla de la app" : "");
      return `- \`${p}\`${nota ? ` — ${nota}` : ""}`;
    })
    .join("\n");
  return [
    `# ${nombre}`,
    "",
    "Proyecto creado con Forja IA. Sin dependencias ni paso de compilación: son archivos normales que puedes abrir y editar con cualquier editor.",
    "",
    "## Cómo verlo",
    usaModulos
      ? "Los módulos de JavaScript necesitan un servidor local (abrir el archivo con doble clic no basta). Desde esta carpeta, con cualquiera de estos:\n\n```bash\nnpx serve .\n# o\npython3 -m http.server 8080\n```\n\nY abre la dirección que te indique (por ejemplo http://localhost:8080)."
      : "Abre `index.html` en el navegador.",
    "",
    "## Qué hay en cada archivo",
    lista,
    "",
    "## Cómo editarlo",
    "Cambia los archivos y recarga el navegador. Para pedirle cambios a la IA, sube esta carpeta a Forja IA o pega el archivo que quieras modificar.",
    "",
    "## Cómo publicarlo",
    "Arrastra la carpeta a https://app.netlify.com/drop, o súbela a un repositorio de GitHub y activa GitHub Pages.",
    "",
  ].join("\n");
}

/** ¿Hace falta añadir README? (no si el proyecto ya trae uno). */
export function faltaReadme(paths: readonly string[]): boolean {
  return !paths.some((p) => /^readme(\.md)?$/i.test(p));
}
