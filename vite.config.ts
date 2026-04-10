import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignore: ["reference-code/**", "playground/public/reference-code/**"],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["reference-code/**", "playground/public/reference-code/**"],
  },
});
