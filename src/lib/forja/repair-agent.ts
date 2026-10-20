/**
 * Forja IA — Repair Agent.
 * Convierte hallazgos verificables en instrucciones de reparación directa.
 * No crea archivos "fix" ni parches auxiliares.
 */

import type { QAItem } from "./visual-qa";

export interface RepairAction {
  priority: "critical" | "high" | "normal";
  target: string;
  instruction: string;
  evidence: string;
}

export interface RepairPlan {
  actions: RepairAction[];
  stopCondition: string;
}

export function buildRepairPlan(items: QAItem[]): RepairPlan {
  const actions: RepairAction[] = items.map((item) => {
    const priority: RepairAction["priority"] =
      item.tipo === "fuera" || item.tipo === "scroll" ? "critical" :
      item.tipo === "contraste" || item.tipo === "sin-nombre" ? "high" : "normal";

    const instruction =
      item.tipo === "scroll" ? "Eliminar el desbordamiento horizontal sin ocultarlo con overflow-x:hidden salvo que sea intencional y demostrado." :
      item.tipo === "fuera" ? "Reubicar o adaptar el elemento para que sea alcanzable en el viewport medido." :
      item.tipo === "texto" ? "Aumentar el tamaño o ajustar la jerarquía tipográfica sin romper el layout." :
      item.tipo === "contraste" ? "Corregir la combinación de texto/fondo manteniendo la dirección visual." :
      item.tipo === "sin-nombre" ? "Añadir nombre accesible al control manteniendo su apariencia." :
      item.tipo === "sin-alt" ? "Añadir alt descriptivo o alt vacío si la imagen es puramente decorativa." :
      "Aumentar el objetivo táctil a un tamaño utilizable.";

    return { priority, target: item.tipo, instruction, evidence: item.detalle };
  });

  return {
    actions: actions.sort((a, b) => {
      const rank = { critical: 0, high: 1, normal: 2 };
      return rank[a.priority] - rank[b.priority];
    }),
    stopCondition: "Volver a ejecutar preview + Visual QA + regression después de cada ciclo. Parar cuando no queden fallos críticos y los restantes sean explicados.",
  };
}

export function repairPrompt(plan: RepairPlan): string {
  return [
    "[FORJA REPAIR AGENT]",
    "Corrige directamente los archivos responsables. No crees archivos fix/patch temporales.",
    ...plan.actions.map((a, i) => `${i + 1}. [${a.priority}] ${a.target}: ${a.instruction} Evidencia: ${a.evidence}`),
    plan.stopCondition,
  ].join("\n");
}
