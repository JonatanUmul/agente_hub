import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  // index.html de la raíz es un respaldo ajeno al proyecto.
  { ignores: ['**/node_modules/**', '**/dist/**', 'index.html'] },
  js.configs.recommended,
  {
    rules: {
      // Prefijo _ para descartar a propósito (ej. al desestructurar para omitir un campo).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/api/**/*.js', 'packages/**/*.js', '*.js', 'apps/web/vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
];
