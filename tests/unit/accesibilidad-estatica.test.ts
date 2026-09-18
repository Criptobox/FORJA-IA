import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* Auditoría estática de accesibilidad: reglas que se pueden vigilar leyendo el
 * fuente, para que un botón mudo o una imagen sin alt no entren al repo. Las
 * reglas que NECESITAN el DOM vivo (contraste real, desbordes, objetivos de
 * toque) viven en el Inspector Visual y en los specs e2e — no se duplican aquí
 * porque el fuente no sabe cómo se pinta, solo cómo se escribe.
 *
 * Discriminador JSX: solo se auditan tags con atributos en notación JSX
 * (`src={` / `onClick={`). Los `<img src="horno.jpg">` que aparecen dentro de
 * template literals son FIXTURES HTML del motor de forjado (datos que el motor
 * parchea), no DOM: auditarlos sería Castigar los datos. */

const RAIZ = join(import.meta.dirname, "../..");
const DIR_SRC = join(RAIZ, "src");

function archivosTsx(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) out.push(...archivosTsx(ruta));
    else if (/\.tsx?$/.test(nombre)) out.push(ruta);
  }
  return out;
}

/** Todos los tags `<img …>` (multilinea) de un archivo con su posición. */
function tagsImg(fuente: string): string[] {
  return fuente.match(/<img\b[\s\S]*?(?:\/>|>)/g) ?? [];
}

/** Tags `<div|span …onClick…>` multilinea (los clickeables accidentales). */
function tagsClickeableDiv(fuente: string): string[] {
  return fuente.match(/<(?:div|span)\b[^>]*?onClick[\s\S]*?(?:\/>|>)/g) ?? [];
}

describe("accesibilidad estática — lo que el fuente puede prometer", () => {
  const archivos = archivosTsx(DIR_SRC);

  it("hay código que auditar (el scan no se queda en vacío por un error de ruta)", () => {
    expect(archivos.length).toBeGreaterThan(50);
  });

  it("todo <img> JSX (con src={…}) lleva atributo alt — alt=\"\" vale si es decorativa", () => {
    const culpables: string[] = [];
    for (const ruta of archivos) {
      const fuente = readFileSync(ruta, "utf8");
      for (const tag of tagsImg(fuente)) {
        if (!tag.includes("src={")) continue; // fixture de string, no DOM
        if (!/\balt=/.test(tag)) {
          culpables.push(`${ruta.replace(RAIZ + "/", "")}: ${tag.slice(0, 60).replace(/\s+/g, " ")}…`);
        }
      }
    }
    expect(
      culpables,
      `imgs sin alt (1.1.1): usa alt="" si es decorativa:\n${culpables.join("\n")}`
    ).toHaveLength(0);
  });

  it("ningún <div>/<span> con onClick carece de role (4.1.2: si actúa como control, decláralo)", () => {
    const culpables: string[] = [];
    for (const ruta of archivos) {
      const fuente = readFileSync(ruta, "utf8");
      for (const tag of tagsClickeableDiv(fuente)) {
        if (!/\brole=/.test(tag)) {
          culpables.push(`${ruta.replace(RAIZ + "/", "")}: ${tag.slice(0, 60).replace(/\s+/g, " ")}…`);
        }
      }
    }
    expect(
      culpables,
      `clickeables sin role:\n${culpables.join("\n")}`
    ).toHaveLength(0);
  });

  it("ningún tabIndex positivo (2.4.3: el orden de tabulación se respeta, no se secuestra)", () => {
    // tabIndex={0|−1} es legítimo; un positivo secuestra el orden natural y
    // siempre acaba mordiendo cuando el árbol cambia
    const culpables: string[] = [];
    for (const ruta of archivos) {
      const fuente = readFileSync(ruta, "utf8");
      const malos = fuente.match(/tabIndex=\{\s*[1-9]\d*\s*\}/g) ?? [];
      for (const m of malos) culpables.push(`${ruta.replace(RAIZ + "/", "")}: ${m}`);
    }
    expect(culpables, `tabIndex positivos:\n${culpables.join("\n")}`).toHaveLength(0);
  });
});
