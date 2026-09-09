import { defineConfig } from 'vite';

// A self-contained classic script needs no production CORS permissions in the opaque frame.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/lib/diagramFrame.ts', name: 'VetoDiagram', formats: ['iife'], fileName: () => 'diagram-renderer.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
