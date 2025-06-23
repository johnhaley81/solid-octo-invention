import js from '@eslint/js';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // React globals
        React: 'readonly',
        // Browser APIs
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        TextEncoder: 'readonly',
        // WebAuthn APIs
        PublicKeyCredential: 'readonly',
        PublicKeyCredentialType: 'readonly',
        AuthenticatorTransport: 'readonly',
        AuthenticatorAttestationResponse: 'readonly',
        AuthenticatorAssertionResponse: 'readonly',
        CredentialCreationOptions: 'readonly',
        CredentialRequestOptions: 'readonly',
        // TypeScript globals
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
      },
    },
    rules: {
      // General rules
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'arrow-spacing': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],

      // Effect-TS specific rules
      'no-throw-literal': 'error', // Prefer Effect.fail over throw
      'prefer-promise-reject-errors': 'error',

      // TypeScript specific overrides
      'no-redeclare': 'off', // TypeScript handles this better
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: {
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['packages/backend/**/*.ts'],
    rules: {
      'no-console': 'off', // Allow console in backend
    },
  },
  {
    ignores: ['dist', 'build', 'node_modules', '*.config.js', '*.config.ts', 'coverage'],
  },
];
