/** Forja IA — Modo App: cuando lo que se pide es una APLICACIÓN, no una página.
 *
 * La skill «Desarrollador web experto» manda un único HTML autónomo, y para
 * una landing es lo mejor: la vista previa crece en vivo sin fricción. Pero
 * una app —un gestor de tareas, un inventario, un panel de control, un CRM—
 * metida en un solo archivo acaba en 1.500 líneas de JS sin estructura, con
 * datos que se pierden al recargar y pantallas a las que no se puede enlazar.
 * Y en cuanto se pide el segundo cambio, el modelo tiene que reescribirlo
 * todo.
 *
 * Esto detecta esa intención y amplía la skill con una arquitectura mínima de
 * app SIN build: módulos ES nativos (el Sandbox y la vista previa ya los
 * resuelven con un import map), estado con persistencia en localStorage (que
 * la vista previa de Forja conserva entre recargas, ver `preview-storage.ts`),
 * rutas por hash y un manifest para que se pueda instalar.
 *
 * Una landing «para mi app» NO es una app: ahí se sigue en un archivo.
 */

const SENALES_APP =
  /\b(app|apps|aplicaci[oó]n|aplicaciones|webapp|web app|dashboard|panel de (?:control|administraci[oó]n|admin)|backoffice|crud|gestor|gesti[oó]n de|administrador de|lista de tareas|to-?do|kanban|inventario|crm|agenda|calendario de|tracker|seguimiento de|control de gastos|presupuesto personal|finanzas personales|app de notas|bloc de notas|registro de)\b/i;

/** Lo que dice que en realidad se quiere una página de presentación. */
const SENALES_PAGINA =
  /\b(landing|p[aá]gina de (?:aterrizaje|presentaci[oó]n|inicio|ventas)|web corporativa|portfolio|portafolio|sitio de presentaci[oó]n|one.?page)\b/i;

/** ¿El encargo pide una aplicación con estado y pantallas, no una página? */
export function esEncargoDeApp(prompt: string): boolean {
  const t = prompt ?? "";
  if (!t.trim()) return false;
  if (SENALES_PAGINA.test(t)) return false;
  return SENALES_APP.test(t);
}

/** La ampliación de la skill, tal cual se añade al prompt. */
export const INSTRUCCION_APP = `### Modo App: esto es una aplicación, no una página suelta
Amplía la skill de desarrollador web en este punto: en vez de un único HTML, entrega una app con módulos ES nativos, **sin build ni CDN**. Cada archivo completo en su propio bloque, con su ruta en la línea de la cerca (p. ej. \`\`\`js — js/store.js):
- \`index.html\`: esqueleto, \`<link rel="stylesheet" href="styles.css">\`, \`<link rel="manifest" href="manifest.webmanifest">\` y \`<script type="module" src="js/app.js"></script>\`.
- \`styles.css\`: tokens (colores, radios, espaciado) en variables CSS en \`:root\`, y el resto usándolos.
- \`js/store.js\`: el estado y su persistencia en localStorage (clave con versión, p. ej. \`miapp:v1\`, lectura dentro de try/catch y datos de ejemplo realistas la primera vez). Exporta funciones, no variables sueltas.
- \`js/router.js\`: rutas por hash (\`#/\`, \`#/tareas/3\`) para que cada pantalla tenga URL y funcione el botón atrás.
- \`js/views/*.js\`: una vista por pantalla; \`js/app.js\` las conecta.
- \`manifest.webmanifest\` (name, short_name, start_url ".", display "standalone", theme_color) e \`icon.svg\`.
Imports relativos y con extensión (\`import { tareas } from "./store.js"\`). Funcionalidad completa, no decorado: crear, editar, borrar (con confirmación o deshacer), buscar y filtrar; validación de formularios con mensajes junto al campo; estados vacío, cargando y error; exportar e importar los datos en JSON. Al cambiar de ruta, mueve el foco al \`<h1>\` de la vista y anuncia los avisos en una región \`aria-live\`. Si algo necesita servidor de verdad (login real, pagos, correo), simúlalo en local y dilo en una línea — nunca inventes una API.`;
