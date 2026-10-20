"use client";
/** Forja IA — Hook de estado del índice de la Knowledge Base (localStorage). */
import { useCallback, useEffect, useState } from "react";
import {
  KB_INDEX_EVENT,
  kbGetResources,
  kbRemoveResource,
  kbStats,
  kbUpdateResource,
  type KBResource,
} from "@/lib/forja/kb-index";

export function useKbIndex(): {
  resources: KBResource[];
  stats: ReturnType<typeof kbStats>;
  remove: (id: string) => void;
  update: (id: string, patch: Parameters<typeof kbUpdateResource>[1]) => void;
} {
  const [resources, setResources] = useState<KBResource[]>([]);

  const refresh = useCallback(() => {
    setResources(kbGetResources());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(KB_INDEX_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(KB_INDEX_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const remove = useCallback(
    (id: string) => {
      kbRemoveResource(id);
      refresh();
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, patch: Parameters<typeof kbUpdateResource>[1]) => {
      kbUpdateResource(id, patch);
      refresh();
    },
    [refresh]
  );

  return { resources, stats: kbStats(resources), remove, update };
}
