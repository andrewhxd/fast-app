import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:mobile` serves over HTTPS on your network, because phones only allow the microphone on HTTPS.
export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'mobile' && basicSsl()],
  build: {
    rollupOptions: {
      output: {
        // Firebase in a file of its own: it rarely changes, so browsers keep it cached across app updates.
        manualChunks(id) {
          if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) return 'firebase';
          return undefined;
        },
      },
    },
  },
}));
