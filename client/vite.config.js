import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/assistant': 'http://localhost:5000',
      '/payment': 'http://localhost:5000',
      '/invoice': 'http://localhost:5000',
      '/attack': 'http://localhost:5000',
      '/audit': 'http://localhost:5000',
      '/2fa': 'http://localhost:5000',
      '/proof': 'http://localhost:5000',
      '/recovery': 'http://localhost:5000',
      '/elder': 'http://localhost:5000',
      '/metrics': 'http://localhost:5000',
      '/healthz': 'http://localhost:5000',
    },
  },
});
