/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.test.ts', 'src/auth-unit.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
