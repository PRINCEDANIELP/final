import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    sourcemap: true,
  },
  css: {
    devSourcemap: true,
  },
});
