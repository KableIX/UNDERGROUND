import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      UNDERGROUND_API_AUTOSTART: '0',
    },
  },
});
