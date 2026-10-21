import vue from "@vitejs/plugin-vue";
import { defineConfig, lazyPlugins } from "vite-plus";

// https://vite.dev/config/
// GitHub Pages project site lives at /toplist-maker/ — set BASE_PATH in CI.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [vue()]),
  test: {
    include: ["src/**/*.test.ts"],
  },
});
