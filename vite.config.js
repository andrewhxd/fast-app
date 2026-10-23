import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:mobile` serves over HTTPS on your network, because phones only allow the microphone on HTTPS.
export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'mobile' && basicSsl()],
}));
