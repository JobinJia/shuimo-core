import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignore: ["**/dist/**", "reference-code/**", "playground/public/reference-code/**"],
  },
  lint: {
    options: { typeAware: false, typeCheck: false },
    ignorePatterns: ["reference-code/**", "playground/public/reference-code/**"],
  },
});
