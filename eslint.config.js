import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      'pnpm-lock.yaml',
      // Metro config must stay CommonJS require() for Expo tooling.
      '**/metro.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // The mobile app loads its bundled photos, audio and fonts with require(): one file each, with
    // no export to import, and the bundler resolves them at build time. Only those are allowed,
    // and only inside the app. require() of anything else, such as a phone feature loaded at the
    // moment it is used, stays an error.
    files: ['apps/mobile/**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': [
        'error',
        { allow: ['\\.(png|jpe?g|webp|gif|mp3|wav|m4a|aac|ttf|otf|woff2?)$'] },
      ],
    },
  },
  eslintConfigPrettier,
];
