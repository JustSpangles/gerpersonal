import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/electron/**/*.test.ts'],
    environment: 'node',
    // node:sqlite todavía avisa que es experimental; no aporta nada en los tests.
    execArgv: ['--disable-warning=ExperimentalWarning'],
  },
});
