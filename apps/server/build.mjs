import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  tsconfig: 'tsconfig.json',
  banner: {
    js: "import { createRequire as __cr } from 'module';\nconst require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
