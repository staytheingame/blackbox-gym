import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testler `@/...` yollarını da çözebilsin diye — tsconfig'deki `paths`
 * ayarı yalnız TypeScript'i ilgilendiriyor, Vitest'in kendi alias'ı gerek.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
