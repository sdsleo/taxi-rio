import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/packages\/shared/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
