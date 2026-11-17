"use client";
/** Forja IA — Editar los archivos del proyecto dentro de Forja.
 *
 * La pestaña «código» de la vista previa era de solo lectura. Aquí se elige un
 * archivo (index.html, styles.css, js/app.js…), se cambia y se guarda: el
 * cambio va a la respuesta, así que la vista previa se repinta y el ZIP, GitHub
 * y la siguiente petición a la IA ya lo llevan. Sin gastar IA. */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ArchivoEditable {
  path: string;
  text: string;
}

export function EditorArchivos({
  archivos,
  onGuardar,
}: {
  archivos: readonly ArchivoEditable[];
  onGuardar: (path: string, texto: string) => { ok: boolean; motivo?: string };
}) {
  const [ruta, setRuta] = useState(archivos[0]?.path ?? "");
  const actual = archivos.find((a) => a.path === ruta) ?? archivos[0];
  const [borrador, setBorrador] = useState(actual?.text ?? "");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const cambiado = !!actual && borrador !== actual.text;

  // Al cambiar de archivo, o cuando el archivo cambia por fuera (la IA lo
  // reescribió), el borrador vuelve a lo guardado.
  useEffect(() => {
    setAviso(null);
  }, [actual?.path]);
  useEffect(() => {
    setBorrador(actual?.text ?? "");
  }, [actual?.path, actual?.text]);

  if (!actual) return <p className="p-4 text-[12px] text-muted-foreground">Esta respuesta no tiene archivos que editar.</p>;

  const guardar = () => {
    const r = onGuardar(actual.path, borrador);
    setAviso(r.ok ? { ok: true, texto: "Guardado. La vista previa y la descarga ya lo llevan." } : { ok: false, texto: `No se pudo guardar: ${r.motivo ?? "motivo desconocido"}` });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="editor-archivos">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5 [scrollbar-width:none]" role="tablist" aria-label="Archivos del proyecto">
        {archivos.map((a) => (
          <button
            key={a.path}
            type="button"
            role="tab"
            aria-selected={a.path === actual.path}
            onClick={() => setRuta(a.path)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] transition",
              a.path === actual.path ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            {a.path}
          </button>
        ))}
      </div>
      <textarea
        aria-label={`Código de ${actual.path}`}
        data-testid="editor-codigo"
        value={borrador}
        onChange={(e) => {
          setBorrador(e.target.value);
          setAviso(null);
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-[12px] leading-relaxed outline-none"
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
        <button
          type="button"
          onClick={guardar}
          disabled={!cambiado}
          data-testid="guardar-archivo"
          className="rounded-full bg-forja-violet px-3 py-1 text-[12px] font-medium text-white transition disabled:opacity-40"
        >
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={() => {
            setBorrador(actual.text);
            setAviso(null);
          }}
          disabled={!cambiado}
          className="rounded-full border border-border/70 px-3 py-1 text-[12px] transition disabled:opacity-40"
        >
          Descartar
        </button>
        {aviso && (
          <span role="status" className={cn("text-[11.5px]", aviso.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {aviso.texto}
          </span>
        )}
      </div>
    </div>
  );
}
