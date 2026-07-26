import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'prisma/generated'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-control-regex': 'off',
      'no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    files: [
      'backend/**/*.js',
      'imports/**/*.js',
      'prisma/**/*.js',
      'scripts/**/*.js',
      'utils/passwords.js',
      'prismaClient.js',
      'runtimeEnv.js',
      'vite.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]
