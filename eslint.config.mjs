import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* Dos fases, para que el lint vuelva a ser una red de seguridad y no un
 * adorno apagado:
 *
 *  FASE 1 (errores): lo que de verdad rompe o esconde bugs — variables sin
 *  usar (con puerta de escape `^_`), `let` que nunca se reasignan,
 *  reasignaciones de parámetros, `case` sin break… Reglas baratas de
 *  mantener y de rentabilidad inmediata.
 *
 *  FASE 2 (avisos): lo que conviene ver sin que bloquee — `any`,
 *  exhaustive-deps del compilador de React, `<img>`… Están a la vista para
 *  irse limpiando por rondas; un aviso NO rompe el build ni el CI.
 *
 * `assets/` queda fuera: `forja-3d.js` es un módulo fabricado a mano que el
 * lint reescribía por su cuenta y rompía los tests (ver git history).
 */
const ignores = [
  "node_modules/**",
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  "examples/**",
  "skills",
  "workspace/**",
  "download/**",
  "scripts/**",
  "db/**",
  ".zscripts/**",
  "motor-forja/**",
  "assets/**",
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores,
  },
  {
    rules: {
      /* ---- FASE 2: avisos (no bloquean) ---- */
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      /* react-compiler/react-compiler: el plugin no viene en las deps del
       * proyecto y ESLint lo exige registrado en cuanto la regla no está
       * «off». Se apaga hasta instalarlo de verdad. */
      "@next/next/no-img-element": "warn",
      "no-console": "off",
      "no-debugger": "warn",
      "no-empty": "warn",
    },
  },
  {
    rules: {
      /* ---- FASE 1: errores (bloquean) ---- */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "no-var": "error",
      "no-irregular-whitespace": "error",
      "no-case-declarations": "error",
      "no-fallthrough": "error",
      "no-mixed-spaces-and-tabs": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "no-useless-escape": "error",

      /* Apagadas a conciencia: las mantuvo la base y aquí va el por qué.
       * - react/display-name y react/prop-types: con funciones y tipos de
       *   TS no aportan nada.
       * - no-undef: TS ya lo lleva (y se equivoca menos con los tipos).
       * - no-unused-vars (el nativo): rige la versión de @typescript-eslint,
       *   duplicarlo solo da avisos dobles.
       * - no-html-link-for-pages: el proyecto no usa <a> para rutas
       *   internas salvo casos medidos. */
      "react/display-name": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-disable-directive": "off",
    },
  },
];

export default eslintConfig;
