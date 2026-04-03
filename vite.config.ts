import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const input = process.env.INPUT;
if (!input) throw new Error("Set INPUT env var");

export default defineConfig({
  build: {
    rollupOptions: { input },
    outDir: "dist",
    emptyOutDir: false,
  },
  plugins: [viteSingleFile()],
});
