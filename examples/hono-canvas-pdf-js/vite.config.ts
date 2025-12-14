import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { createNodejsFnPlugin } from "../../src";

export default defineConfig({
  plugins: [
    createNodejsFnPlugin({
      external: ["@napi-rs/canvas", "pdfjs-dist"],
    }),
    cloudflare(),
  ],
});
