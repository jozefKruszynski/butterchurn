import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      curly: "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      semi: ["error", "always"],
      strict: ["error", "global"],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "experiments/", "test/visual/__image_snapshots__/"],
  },
];
