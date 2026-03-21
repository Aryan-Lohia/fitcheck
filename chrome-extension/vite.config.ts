import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/content.ts"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "src/manifest.json", dest: "." },
        { src: "icons/*", dest: "icons" },
      ],
    }),
  ],
});
