/** Banco de pruebas con un modelo DE VERDAD: ¿las skills de pantalla
 * funcionan con modelos gratis y prompts cortos?
 *
 * Se salta solo si no hay clave (en CI y en local por defecto). Para correrlo,
 * con cualquier API compatible con OpenAI (Groq, OpenRouter, Cerebras, Gemini
 * vía su endpoint OpenAI…):
 *
 *   FORJA_VIVO_URL=https://api.groq.com/openai/v1 \
 *   FORJA_VIVO_KEY=gsk_… FORJA_VIVO_MODELO=llama-3.3-70b-versatile \
 *   npx vitest run tests/unit/estudio-skills-vivo.test.ts
 *
 * Genera una pantalla por skill con los prompts reales del Estudio (system
 * del proyecto + pedido con sus skills) y otra por el runtime del adaptador
 * (`RuntimeModelo`). Exige HTML en todas; los fallos de patrón se imprimen
 * como informe (un modelo gratis puede saltarse alguno: para eso está
 * «Corregir con IA»), y se exige que al menos la mitad salgan limpias. */

import { describe, expect, it } from "vitest";
import { crearProyecto, direccionDe } from "../../src/lib/forja/estudio/proyecto";
import { pedidoPantalla, promptSistema } from "../../src/lib/forja/estudio/prompts";
import { comprobarSkills, skillsDePantalla } from "../../src/lib/forja/estudio/skills";
import { extraerCodigo } from "../../src/lib/forja/motor/nucleo-extractos";
import { pareceHtml, RuntimeModelo } from "../../src/lib/forja/motor/runtime-modelo";
import type { LlamadaModelo } from "../../src/lib/forja/motor/tipos";
import type { OpenDesignRequest } from "../../src/lib/forja/motor/adapter-opendesign";

const URL_API = process.env.FORJA_VIVO_URL ?? "";
const CLAVE = process.env.FORJA_VIVO_KEY ?? "";
const MODELO = process.env.FORJA_VIVO_MODELO ?? "";
const hay = Boolean(URL_API && CLAVE && MODELO);

const llamada: LlamadaModelo = async (a) => {
  const r = await fetch(`${URL_API.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${CLAVE}` },
    body: JSON.stringify({
      model: a.modelId,
      temperature: a.temperatura,
      max_tokens: Math.min(a.maxTokens ?? 8000, 8000),
      messages: [
        { role: "system", content: a.system },
        { role: "user", content: a.user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? "";
};

const PANTALLAS = [
  "Iniciar sesión",
  "Inicio",
  "Mis reservas",
  "Nueva reserva",
  "Detalle de la pista",
  "Buscar pistas",
  "Ajustes",
  "Bienvenida",
  "Planes premium",
  "Asistente",
];

describe.skipIf(!hay)("estudio · skills con un modelo real", () => {
  const p = crearProyecto({ brief: "App de reservas para un club de pádel en Valencia", tipo: "app" });
  const sistema = promptSistema(p, direccionDe(p));

  it(
    "cada skill produce HTML con los prompts del Estudio",
    async () => {
      const informe: string[] = [];
      let limpias = 0;
      for (const nombre of PANTALLAS) {
        const s = { nombre, proposito: "" };
        const skills = skillsDePantalla(s, p.tipo);
        const usuario = pedidoPantalla(p, s);
        const texto = await llamada({ providerId: "vivo", modelId: MODELO, system: sistema, user: usuario, temperatura: 0.6 });
        const html = extraerCodigo(texto);
        expect(pareceHtml(html), `«${nombre}» no devolvió HTML`).toBe(true);
        const fallos = comprobarSkills(html, skills, p.tipo);
        if (!fallos.length) limpias++;
        informe.push(`${nombre} [${skills.join(", ")}] prompt ${sistema.length + usuario.length} car. → ${fallos.length ? fallos.join(" | ") : "OK"}`);
      }
      console.log(`\nModelo ${MODELO}\n${informe.join("\n")}\nLimpias: ${limpias}/${PANTALLAS.length}`);
      expect(limpias).toBeGreaterThanOrEqual(Math.ceil(PANTALLAS.length / 2));
    },
    600_000
  );

  it(
    "el runtime del adaptador genera con el modelo",
    async () => {
      const req: OpenDesignRequest = {
        requestId: "vivo",
        projectId: "vivo",
        brief: "# Brief\nPantalla de acceso de una app de reservas de un club de pádel en Valencia",
        direccion: "Editorial cálida",
        designSystem: { nombre: "Pádel", identidad: "cálida", colores: ["#1d4d3a"], tokensCss: ":root{--color-acento:#1d4d3a}", designMd: "" } as OpenDesignRequest["designSystem"],
        skills: ["producto", "acceso"],
        prompts: [{ rol: "codificador", system: "Eres el Codificador de FORJA IA.", user: "Construye la pantalla completa." }],
        limites: { maxIteraciones: 2, maxCaracteres: 120_000 },
      };
      const art = await new RuntimeModelo({ llamada, modelo: { providerId: "vivo", modelId: MODELO } }).ejecutar(req);
      console.log(art.trazas.join("\n"));
      expect(art.ok, art.error).toBe(true);
    },
    300_000
  );
});
