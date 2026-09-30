import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { files:['browser-runner/**/*.cjs'], rules:{'@typescript-eslint/no-require-imports':'off'} },
  globalIgnores([".next/**", ".next-desktop/**", "src-tauri/target/**", "public/monaco/**", "out/**", "next-env.d.ts"]),
]);


