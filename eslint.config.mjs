import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ["lib/generated/**", ".next/**", ".next-e2e/**", "storage/**", "playwright-report/**", "test-results/**"] },
];

export default config;
