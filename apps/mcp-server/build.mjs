import { build } from "esbuild";
import { builtinModules } from "node:module";

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

// Zod v4's $constructor() crashes in workerd ("Class2 is not a constructor").
// Rewrite only exact "zod" → "zod/v3"; leave "zod/v3", "zod/v4", "zod/v4-mini" alone.
const zodV3Plugin = {
  name: "zod-v3",
  setup(b) {
    b.onResolve({ filter: /^zod$/ }, (args) =>
      b.resolve("zod/v3", { resolveDir: args.resolveDir, kind: args.kind }),
    );
  },
};

// workerd supports node builtins via ESM import (nodejs_compat) but NOT CJS require().
// esbuild wraps CJS deps in __commonJS which calls require() for externals.
// Provide a require() that delegates to pre-imported ESM bindings.
const polyfilled = [
  "buffer", "child_process", "crypto", "dns", "events", "fs",
  "http", "https", "net", "os", "path", "stream", "tls", "url",
  "util", "zlib",
];
const imports = polyfilled.map((m) => `import __n_${m} from "node:${m}";`).join("\n");
const map = polyfilled.map((m) => `"${m}":__n_${m},"node:${m}":__n_${m}`).join(",");
const banner = `${imports}\nvar require=(id)=>({${map}})[id]||(__=>{throw Error("require not supported: "+id)})();`;

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  format: "esm",
  target: "esnext",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "import"],
  plugins: [zodV3Plugin],
  external: [...nodeBuiltins, "cloudflare:*"],
  banner: { js: banner },
  logLevel: "warning",
});
