/** FORJA IA — Runtime del adaptador OpenDesign con un modelo real (fase 4).
 *
 * `RuntimeLocal` compone HTML sin modelo; este hace lo mismo que haría el
 * daemon de OpenDesign: toma la `OpenDesignRequest` (brief + design system +
 * skills + prompts de rol) y se la da a un modelo. El modelo NO se elige
 * aquí: entra como `LlamadaModelo`, la misma firma que usa el núcleo, así
 * que vale la cadena Auto de modelos gratis (`llamadaAuto` en el Estudio),
 * una clave de pago o un doble de pruebas.
 *
 * Pensado para modelos gratis: el brief se recorta a `techoBrief`, las
 * skills van condensadas y, si el modelo charla en vez de entregar HTML, se
 * le vuelve a pedir (hasta `limites.maxIteraciones`) recordándole el formato.
 * Nunca lanza: los fallos salen como `ok: false` con el motivo. */

import type { OpenDesignArtifact, OpenDesignRequest, RuntimeOpenDesign } from "./adapter-opendesign";
import { habilidadPorId } from "./habilidades";
import { extraerCodigo } from "./nucleo-extractos";
import type { LlamadaModelo } from "./tipos";
import { bloqueSkills, skillPorId } from "../estudio/skills";

export interface OpcionesRuntimeModelo {
  llamada: LlamadaModelo;
  /** proveedor/modelo que se pasa a la llamada («auto» si decide la cadena) */
  modelo: { providerId: string; modelId: string };
  /** quién produjo de verdad el artefacto (con Auto, el modelo que respondió) */
  productor?: () => string;
  /** convierte ids de skill en el bloque del prompt (por defecto: skills de
   * pantalla del Estudio y habilidades del motor) */
  resolverSkills?: (ids: readonly string[]) => string;
  /** caracteres de brief que viajan (prompt corto para modelos gratis) */
  techoBrief?: number;
  maxTokens?: number;
  temperatura?: number;
}

/** Skills por id: primero las de pantalla del Estudio, luego las del motor. */
export function resolverSkillsPorDefecto(ids: readonly string[]): string {
  const deEstudio = ids.filter((id) => skillPorId(id));
  const delMotor = ids
    .filter((id) => !skillPorId(id))
    .map((id) => habilidadPorId(id)?.texto)
    .filter((x): x is string => Boolean(x));
  return [bloqueSkills(deEstudio), ...delMotor].filter(Boolean).join("\n\n");
}

const FORMATO = "Salida: UN solo bloque ```html con el documento completo (<!doctype html> … </html>), CSS en <style>. Nada más.";
const RECORDATORIO = "Tu respuesta anterior no traía el documento HTML. Entrega AHORA solo el bloque ```html con el documento completo, sin explicaciones.";

/** ¿El texto extraído es un documento HTML de verdad? */
export function pareceHtml(s: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]/i.test(s) && /<\/(html|body)>|<\/main>|<\/div>/i.test(s);
}

export class RuntimeModelo implements RuntimeOpenDesign {
  readonly nombre: string;
  readonly tipo = "opendesign" as const;
  private readonly o: OpcionesRuntimeModelo;

  constructor(o: OpcionesRuntimeModelo) {
    this.o = o;
    this.nombre = `runtime-modelo:${o.modelo.providerId}:${o.modelo.modelId}`;
  }

  /** Los prompts que verá el modelo (separado para medirlos en pruebas). */
  prompts(req: OpenDesignRequest): { system: string; user: string } {
    const cod = req.prompts.find((x) => x.rol === "codificador");
    const skills = (this.o.resolverSkills ?? resolverSkillsPorDefecto)(req.skills);
    const system = [
      cod?.system ?? "Eres el Codificador de FORJA IA. Cumples el design system al pie de la letra.",
      `Dirección: ${req.direccion}`,
      `## Design system «${req.designSystem.nombre}» (usa estas variables, no colores sueltos)`,
      "```css",
      req.designSystem.tokensCss.slice(0, 3000),
      "```",
      skills,
      FORMATO,
    ]
      .filter(Boolean)
      .join("\n");
    const user = [req.brief.slice(0, this.o.techoBrief ?? 3500), "", cod?.user ?? "Construye la página completa."].join("\n");
    return { system, user };
  }

  async ejecutar(req: OpenDesignRequest): Promise<OpenDesignArtifact> {
    const { system, user } = this.prompts(req);
    const trazas: string[] = [`prompt: ${system.length} + ${user.length} caracteres`];
    const intentos = Math.max(1, Math.min(req.limites.maxIteraciones || 1, 3));
    let pedido = user;
    let error = "";
    for (let i = 1; i <= intentos; i++) {
      let salida = "";
      try {
        salida = await this.o.llamada({
          providerId: this.o.modelo.providerId,
          modelId: this.o.modelo.modelId,
          system,
          user: pedido,
          temperatura: this.o.temperatura ?? 0.6,
          rol: "codificador",
          maxTokens: this.o.maxTokens ?? 12_000,
        });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        trazas.push(`intento ${i}: el modelo falló (${error.slice(0, 120)})`);
        break; // la cadena Auto ya probó los demás modelos: reintentar no ayuda
      }
      const html = extraerCodigo(salida);
      if (pareceHtml(html)) {
        if (html.length > req.limites.maxCaracteres) {
          error = `El HTML supera el límite (${html.length} > ${req.limites.maxCaracteres} caracteres)`;
          trazas.push(`intento ${i}: ${error}`);
          break;
        }
        trazas.push(`intento ${i}: HTML de ${html.length} caracteres`);
        return {
          requestId: req.requestId,
          html,
          tokensCss: req.designSystem.tokensCss,
          designMd: req.designSystem.designMd,
          productor: this.o.productor?.() || `${this.o.modelo.providerId}:${this.o.modelo.modelId}`,
          trazas,
          ok: true,
          error: "",
        };
      }
      error = "El modelo no devolvió un documento HTML";
      trazas.push(`intento ${i}: sin HTML (${salida.length} caracteres de texto)`);
      pedido = `${user}\n\n${RECORDATORIO}`;
    }
    return {
      requestId: req.requestId,
      html: "",
      tokensCss: req.designSystem.tokensCss,
      designMd: req.designSystem.designMd,
      productor: this.o.productor?.() || this.nombre,
      trazas,
      ok: false,
      error,
    };
  }
}
