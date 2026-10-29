import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { files:['browser-runner/**/*.cjs'], rules:{'@typescript-eslint/no-require-imports':'off'} },
  // Bundled third-party Python runtime, including generated docs and vendored JS.
  globalIgnores(["Python/**", ".next/**", ".next-desktop/**", "src-tauri/target/**", "target/**", "agent/target/**", "public/monaco/**", "out/**", "next-env.d.ts", "resources/**"]),
]);


