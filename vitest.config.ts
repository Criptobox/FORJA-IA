import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // mismo alias "@/…" que Next resuelve vía tsconfig: sin esto, un módulo de
    // src/ que importe a otro con alias no se puede probar en vitest
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.prop.ts"],
  },
});
