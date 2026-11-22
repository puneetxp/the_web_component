// Library build: one file per app to load, dist-lib/the-web-components.js (ES module).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "the-web-components.js" },
  },
});
