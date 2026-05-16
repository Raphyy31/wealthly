import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true, // expose on network for mobile testing
    // In dev, proxy API calls to the backend so we don't hit CORS issues
    proxy: {
      '/api': {
        // VITE_DEV_API_PROXY: backend URL to forward /api to in dev.
        // Defaults to Railway prod so devs without a local FastAPI still get
        // real data. Override via env if you run the backend locally.
        target: process.env.VITE_DEV_API_PROXY || 'https://wealthly-production-45aa.up.railway.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          icons: ['lucide-react'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});
