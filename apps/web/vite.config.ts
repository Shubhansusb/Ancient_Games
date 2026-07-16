import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Mancala — Ancient Games',
        short_name: 'Mancala',
        description: 'The ancient sowing game. No ads, no pay-to-win, free forever.',
        theme_color: '#3ba55d',
        background_color: '#fff9ee',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
});
