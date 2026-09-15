"use client";
/** Prism AI — Project Tasks: tareas locales y verificables del proyecto. */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./store";

export type TaskStatus = "todo" | "doing" | "done";
export interface ProjectTask {
  id: string; title: string; status: TaskStatus; createdAt: number; updatedAt: number;
  source?: "user" | "qa" | "agent" | "system"; evidence?: string;
}
interface TaskState {
  tasks: ProjectTask[];
  add: (title: string, source?: ProjectTask["source"]) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  remove: (id: string) => void;
  clearDone: () => void;
}
const uid = () => {
  try { return `task-${crypto.randomUUID()}`; }
  catch { return `task-${Date.now().toString(36)}`; }
};
export const useProjectTasks = create<TaskState>()(persist((set) => ({
  tasks: [],
  add: (title, source = "user") => set((s) => {
    const t = title.trim(); if (!t) return s;
    const now = Date.now();
    const nueva: ProjectTask = { id: uid(), title: t.slice(0, 240), status: "todo", createdAt: now, updatedAt: now, source };
    return { tasks: [nueva, ...s.tasks].slice(0, 200) };
  }),
  setStatus: (id, status) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, status, updatedAt: Date.now() } : t) })),
  remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  clearDone: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== "done") })),
}), { name: "prism-project-tasks-v1", storage: createJSONStorage(safeLocalStorage) }));
