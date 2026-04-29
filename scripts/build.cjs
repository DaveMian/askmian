const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["api/boot.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "dist",
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
  external: ["mysql2"],
}).catch(() => process.exit(1));
