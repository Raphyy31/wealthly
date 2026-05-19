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
    // Bump warning limit — recharts seul fait ~600 KB, c'est attendu pour
    // une app finance avec dataviz. Le code-split via manualChunks suffit
    // pour le tree-shaking au runtime.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          // Dataviz lourde (~600 KB) — chargée uniquement quand un chart est visible
          recharts: ['recharts'],
          // Icônes — chargées avec l'app shell mais isolées pour cache séparé
          icons: ['lucide-react'],
          // PDF export — utilisé seulement quand l'user clique "Bilan PDF"
          pdf: ['jspdf', 'jspdf-autotable'],
          // Spreadsheet — utilisé seulement à l'import CSV
          xlsx: ['xlsx'],
          // Animations — séparées du shell (peuvent être lazy si reduced-motion)
          motion: ['framer-motion', 'gsap'],
          // i18n — chargé tôt mais bénéficie d'un cache long séparé
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
});
