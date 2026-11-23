import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Architecture rule: risk logic is pure. No React, no Next, no wallet/network libraries.
  {
    files: ['src/risk/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*'],
              message: 'src/risk must stay framework-free.',
            },
            { group: ['wagmi', 'wagmi/*', '@tanstack/*'], message: 'src/risk must not do I/O.' },
            {
              group: ['@/hooks/*', '@/components/*', '@/providers/*'],
              message: 'src/risk must not depend on UI or providers.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'fetch', 'window', 'document', 'localStorage'],
    },
  },
  // Architecture rule: components never reach the network; hooks wrap providers.
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/providers/*'],
              message: 'Components use hooks from src/hooks, not providers directly.',
            },
            {
              group: ['wagmi/actions', 'viem/actions'],
              message: 'Network actions belong in src/hooks or src/providers.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'fetch'],
    },
  },
];

export default config;
