/** Forja IA — Diseñar a partir de una imagen de referencia.
 *
 * Adjuntar una captura («hazla como esta») ya llegaba al modelo como imagen,
 * pero sin decirle QUÉ hacer con ella: unas veces la copiaba entera (textos y
 * logo incluidos), otras la ignoraba y hacía su plantilla de siempre.
 *
 * Esto detecta el caso —una imagen adjunta en un encargo de diseño web— y
 * amplía el prompt con el contrato del Vision Designer (`vision-designer.ts`):
 * primero leer la referencia como SISTEMA visual (composición, jerarquía,
 * ritmo, paleta, tipografía, superficies), después construir una
 * interpretación original con el contenido del usuario. La paleta y la
 * tipografía observadas salen como tokens de `:root`, así el editor de
 * estilos de la vista previa puede retocarlas después con un clic.
 */
import { visionDesignerPrompt } from "./vision-designer";

const PIDE_REFERENCIA =
  /\b(como (?:esta|este|la de la|en la) (?:imagen|captura|foto|referencia)?|como esta|como este|inspirad[oa]s? en|basad[oa]s? en|parecid[oa]s? a|al estilo de|mismo estilo|esta referencia|la referencia|la captura|esta captura|esta imagen|este dise[ñn]o|r[ée]plica|recrea)\b/i;

const ENCARGO_WEB =
  /\b(web|p[áa]gina|landing|sitio|app|aplicaci[oó]n|dashboard|panel|interfaz|ui|pantalla|dise[ñn]o|maqueta|hero|portada|secci[oó]n|componente)\b/i;

/** ¿Hay que tratar las imágenes adjuntas como referencia de diseño? */
export function pideDisenoDeReferencia(texto: string, numImagenes: number): boolean {
  if (numImagenes < 1) return false;
  const t = texto ?? "";
  return PIDE_REFERENCIA.test(t) || ENCARGO_WEB.test(t);
}

export function instruccionReferencia(numImagenes: number): string {
  return [
    "### Diseño a partir de la referencia adjunta",
    visionDesignerPrompt(numImagenes),
    "",
    "Antes del código, escribe una **Lectura de la referencia** breve (5-8 líneas): composición y retícula, jerarquía, ritmo y espaciado, paleta (4-6 colores aproximados en hex), tipografía (familia de estilo, pesos, escala), superficies (radios, sombras, bordes) y un rasgo memorable.",
    "Después construye con el CONTENIDO del encargo del usuario, no con el de la imagen: nada de copiar sus textos, marca, logos ni fotos. Si la referencia es de otra marca, conserva los principios, no la identidad.",
    "Declara la paleta y las fuentes observadas como variables en `:root` (`--fondo`, `--texto`, `--acento`…) y úsalas en todo el CSS: así se pueden retocar luego desde la vista previa.",
    "Si algo de la imagen no se distingue bien (un color, una fuente), dilo y elige con criterio en vez de inventar que lo viste.",
  ].join("\n");
}
