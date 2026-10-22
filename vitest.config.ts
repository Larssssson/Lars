import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // Platzhalter für die Konfiguration; Einheitstests greifen nie auf die Datenbank zu
          env: { DATABASE_URL: "postgresql://einheitstest-ohne-datenbank" },
        },
      },
      {
        extends: true,
        test: {
          name: "adapters",
          include: ["tests/adapters/**/*.test.ts"],
          environment: "node",
          // echte Adapter gegen Azurite und lokale Mock-Server, ohne Datenbank und ohne Internet
          env: { DATABASE_URL: "postgresql://adaptertest-ohne-datenbank" },
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          // eine gemeinsame Testdatenbank, daher nacheinander
          fileParallelism: false,
        },
      },
    ],
  },
});
