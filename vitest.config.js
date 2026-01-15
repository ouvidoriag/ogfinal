/**
 * Vitest Configuration
 * 
 * REFATORAÇÃO: Adicionado para testes unitários
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'public/scripts/core/chart-communication/*.js'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'ANTIGO/**',
        '**/*.config.js',
        '**/*.test.js',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        'chart-communication.js' // Integrador, não precisa de coverage
      ],
      // Thresholds desabilitados temporariamente
      // Os arquivos são carregados via script tags, não como módulos ES6
      // Coverage será medido após migração TypeScript
      // thresholds: {
      //   lines: 70,
      //   functions: 70,
      //   branches: 70,
      //   statements: 70
      // }
    },
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: ['node_modules', 'dist', 'ANTIGO']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './NOVO/src'),
      '@core': path.resolve(__dirname, './NOVO/public/scripts/core'),
      '@pages': path.resolve(__dirname, './NOVO/public/scripts/pages'),
      '@utils': path.resolve(__dirname, './NOVO/public/scripts/utils')
    }
  }
});

