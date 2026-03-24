import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'docs',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cabin: resolve(__dirname, 'cabin.html'),
        mobile: resolve(__dirname, 'mobile.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
