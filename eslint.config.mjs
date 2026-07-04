import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next bundles only 6 basic jsx-a11y rules (alt-text, aria-*)
  // i już rejestruje plugin "jsx-a11y" — dokładamy tylko `rules` z pełnego
  // recommended (WCAG 2.2 AA jest inwariantem, CLAUDE.md), bez re-rejestracji pluginu.
  {
    files: ["**/*.{ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sanity Studio build output — wendorowane bundla, nie lintujemy.
    "dist/**",
    ".gitnexus/**",
  ]),
]);

export default eslintConfig;
