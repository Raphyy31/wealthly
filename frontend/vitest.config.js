import { defineConfig } from 'vitest/config';

// Vitest config — séparée de vite.config.js parce que la config dev Vite
// importe @vitejs/plugin-react + tailwindcss qui ne sont pas requis pour
// les tests purs (taxFr.js etc. sont des modules JS sans React).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    globals: false,
  },
});
