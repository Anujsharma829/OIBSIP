import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// /api calls are proxied to the backend, so there are no CORS problems on any host/port.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
  preview: { port: 5173, proxy: { '/api': 'http://localhost:5000' } }
});
