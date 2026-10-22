import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tests/test-db";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "de-DE", timezoneId: "Europe/Berlin" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/kein-zugang`, // ohne Datenbank erreichbar; globalSetup legt sie danach an
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_PROVIDER: "dev",
      AUTH_SECRET: "nur-fuer-tests",
      DOCUMENT_STORE: "mock",
      FILE_STORAGE: "local",
      AI_PROVIDER: "mock",
      PUSH_PROVIDER: "mock",
      STORAGE_DIR: "./storage/e2e",
      // eigener Build-Ordner, damit die Tests neben `npm run dev` laufen können
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
