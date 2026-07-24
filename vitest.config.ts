import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        // server-only パッケージをテスト環境でモックとして扱う
        inline: ['server-only'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'server-only': resolve(__dirname, 'src/__mocks__/server-only.ts'),
    },
  },
});
