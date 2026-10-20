#!/usr/bin/env python3
"""Limpieza v4.68.0 — elimina/renombra variables e imports sin uso (Fase 1 ESLint)."""
import re, sys

def edit(path, fn):
    with open(path, encoding="utf-8") as f:
        s = f.read()
    ns = fn(s)
    if ns == s:
        print(f"!! SIN CAMBIO: {path}")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(ns)
    print(f"ok: {path}")

def drop_named_import(s, name):
    # import { A, name, B } from "..."  →  quita `name,` o `, name` o `type name`
    for pat in (
        rf"\b{name},\s*\n",            # name al final de línea con coma
        rf"\b{name},\s",               # name al principio con coma y espacio
        rf",\s*{name}\b",              # name tras coma
        rf",\s*type {name}\b",         # type name tras coma
        rf"\btype {name},\s*\n",       # type name al final de línea
        rf"\btype {name},\s",          # type name al principio
    ):
        s2 = re.sub(pat, "", s)
        if s2 != s:
            return s2
    # import único: import { name } from "..."  →  quitar línea entera
    return re.sub(rf'import (?:type )?\{{ {name} \}} from "[^"]+";\n', "", s)

def rename_word(s, old, new, once=False):
    pat = re.compile(rf"\b{re.escape(old)}\b")
    return pat.sub(new, s, count=1 if once else 0)

# ---------- imports sin uso: quitar de la lista ----------
for path, names in [
    ("src/components/forja/calidad-tabs.tsx", ["Button"]),
    ("src/components/forja/gasto-panel.tsx", ["fmtMs"]),
    ("src/components/forja/mega-dialog.tsx", ["cn"]),
    ("src/components/forja/mega-kb-import.tsx", ["FolderOpen", "kbGetResources"]),
    ("src/components/forja/model-picker.tsx", ["CommandInput"]),
    ("src/components/forja/presentation-dialog.tsx", ["Play"]),
    ("src/components/forja/quota-panel.tsx", ["buildRequest"]),
    ("src/components/forja/usage-panel.tsx", ["useEffect"]),
    ("src/lib/forja/chat-client.ts", ["buildToolResultMessage"]),
    ("src/lib/forja/forja-sync-sources.ts", ["StorageItem"]),
    ("tests/unit/request-log.test.ts", ["redactHeaders"]),
    ("tests/unit/tools-v7.test.ts", ["beforeEach", "RunOutcome"]),
]:
    for n in names:
        edit(path, lambda s, n=n: drop_named_import(s, n))

# ToolResult: es import de TIPO en chat-client
edit("src/lib/forja/chat-client.ts", lambda s: s.replace(
    'import type { ToolDef, ToolCall, ToolResult } from "./tools-catalog";',
    'import type { ToolDef, ToolCall } from "./tools-catalog";'))
# free-models: la línea entera queda sin uso
edit("src/lib/forja/free-models.ts", lambda s: s.replace(
    'import { makeModelKey, splitModelKey } from "./types";\n', ""))

# ---------- parámetros sin uso → prefijo _ ----------
def rename_param(path, old, line_hint, occurrence=1):
    def fn(s, old=old, line_hint=line_hint, occurrence=occurrence):
        lines = s.split("\n")
        idx = line_hint - 1
        # sustituye solo en esa línea, la N-ésima OCURRENCIA DE PALABRA COMPLETA
        pat = re.compile(rf"\b{re.escape(old)}\b")
        hits = list(pat.finditer(lines[idx]))
        if occurrence > len(hits):
            return s
        m = hits[occurrence - 1]
        lines[idx] = lines[idx][:m.start()] + "_" + lines[idx][m.start():]
        return "\n".join(lines)
    edit(path, fn)

rename_param("src/components/forja/inspector-visual.tsx", "vw", 78)
rename_param("src/components/forja/inspector-visual.tsx", "vh", 78)
rename_param("src/components/forja/providers-tab.tsx", "id", 73)
rename_param("src/lib/forja/health.ts", "get", 71)
rename_param("src/lib/forja/memoria-proyecto.ts", "v", 306)
rename_param("src/lib/forja/forja-pagina-demo.ts", "adn2", 375)
rename_param("tests/unit/tools-v7.test.ts", "code", 26)
rename_param("src/lib/forja/tools-translate.ts", "i", 110)

# ---------- locales sin uso → prefijo _ (mínimo diff, conserva intención) ----------
for path, name, line_hint in [
    ("src/components/forja/free-radar.tsx", "hasOpenRouterKey", 685),
    ("src/components/forja/repo-cloud-panel.tsx", "closeFile", 226),
    ("src/components/forja/settings-dialog.tsx", "apagados", 774),
    ("src/components/forja/settings-dialog.tsx", "sinPermiso", 778),
    ("src/lib/forja/cache-prompt.ts", "VACIO", 137),
    ("src/lib/forja/modelos-viejos.ts", "MODELOS_FECHA", 21),
    ("src/lib/forja/patch.ts", "MARCA_MID", 55),
    ("src/lib/forja/precios.ts", "PRECIOS_FECHA", 28),
    ("src/lib/forja/project-map.ts", "fileNames", 435),
    ("src/lib/forja/sandbox-runner.ts", "isHtmlPath", 23),
    ("src/lib/forja/tools-probe.ts", "cuerpoSinTools", 148),
    ("src/lib/forja/use-generation.ts", "health", 1618),
    ("tests/e2e/repaso.spec.ts", "seedRepaso", 29),
    ("tests/e2e/studio.spec.ts", "BASE", 444),
    ("tests/unit/ofertas.test.ts", "OFERTAS_VERIFICADO", 5),
]:
    def fn(s, name=name, line_hint=line_hint):
        lines = s.split("\n")
        idx = line_hint - 1
        pos = lines[idx].find(name)
        if pos == -1:
            return s
        before = lines[idx][pos-1:pos]
        after = lines[idx][pos+len(name):pos+len(name)+1]
        if (before.isalnum() or before == "_") or (after.isalnum() or after == "_"):
            return s
        lines[idx] = lines[idx][:pos] + "_" + lines[idx][pos:]
        return "\n".join(lines)
    edit(path, fn)

# ---------- casos especiales ----------
# kb-repo-analyzer: función ext() sin uso → fuera; const lower sin uso → fuera
edit("src/lib/forja/kb-repo-analyzer.ts", lambda s: s.replace(
    'function ext(path: string): string { const m = path.match(/\\.([^./]+)$/); return m ? m[1]!.toLowerCase() : ""; }\n',
    ""))
edit("src/lib/forja/kb-repo-analyzer.ts", lambda s: s.replace(
    "    const lower = e.path.toLowerCase();\n", ""))

# html-a-texto: NBSP literal en la clase → escape \\u00a0 (mismo comportamiento)
edit("src/lib/forja/html-a-texto.ts", lambda s: s.replace(
    "[ \\t\u00a0]+", "[ \\t\\\\u00a0]+"))

print("LISTO")
