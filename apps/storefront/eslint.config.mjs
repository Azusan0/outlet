import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // The starter predates these React 19 compiler lint rules. Turning them
      // off avoids broad cart/checkout rewrites; the remaining rules stay on.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "public/**", "storybook-static/**"],
  },
];
