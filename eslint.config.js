/**
 * Les règles du code (ESLint) : les recommandations de JavaScript et de TypeScript, celles de Vue
 * pour ses composants (.vue, lus avec TypeScript), et des noms qui disent ce qu'ils désignent (au
 * moins deux lettres, sauf x et y pour des coordonnées).
 * La mise en forme est l'affaire de Prettier : ses règles sont retirées d'ESLint.
 */
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "dev-dist"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs["flat/recommended"],
  {
    // TypeScript vérifie déjà les noms et les propriétés facultatives ; un composant peut tenir en un
    // mot (App, Button)
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: { "no-undef": "off", "vue/multi-word-component-names": "off", "vue/require-default-prop": "off" },
  },
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "id-length": ["error", { min: 2, exceptions: ["x", "y", "_"], properties: "never" }],
    },
  },
  {
    // le texte .prisma s'aligne en colonnes : dans les tests, les espaces d'une expression régulière
    // se lisent mieux tels qu'ils sont écrits dans le fichier que comptés ({2})
    files: ["**/*.test.ts", "tests/**"],
    rules: { "no-regex-spaces": "off" },
  },
  prettier,
);
