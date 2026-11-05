/**
 * Les règles du code (ESLint) : les recommandations de JavaScript et de TypeScript, les deux règles
 * classiques des hooks de React, et des noms qui disent ce qu'ils désignent (au moins deux lettres,
 * sauf x et y pour des coordonnées). La mise en forme est l'affaire de Prettier : ses règles sont
 * retirées d'ESLint.
 *
 * Les noms d'une lettre ne sont encore qu'un avertissement : ils seront renommés à l'étape suivante
 * de la migration vers Vue, et la règle passera alors en erreur.
 */
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "dev-dist"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "id-length": ["warn", { min: 2, exceptions: ["x", "y"], properties: "never" }],
    },
  },
  {
    // le texte .prisma s'aligne en colonnes : dans les tests, les espaces d'une expression régulière
    // se lisent mieux tels qu'ils sont écrits dans le fichier que comptés ({2})
    files: ["tests/**"],
    rules: { "no-regex-spaces": "off" },
  },
  prettier,
);
