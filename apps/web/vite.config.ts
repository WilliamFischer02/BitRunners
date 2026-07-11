import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Vendor splitting (perf pass P1, devlog 0139): heavy deps get their
        // own long-lived chunks so app-code changes don't bust their cache,
        // and surfaces that never need them (title, writer portal) never
        // download them.
        // Function form, not object form: object form parked rollup's shared
        // CJS-interop helper inside the colyseus chunk, which made the entry
        // (react-dom interop) statically import all 37 kB of colyseus at boot.
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/colyseus') || id.includes('node_modules/@colyseus'))
            return 'colyseus';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          )
            return 'react';
          return undefined;
        },
      },
    },
  },
});
