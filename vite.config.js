import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/idb')) {
            return 'storage-vendor';
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup.js'
  }
});
