import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/*", "out/*", "convex/_generated/*"],
  },
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
