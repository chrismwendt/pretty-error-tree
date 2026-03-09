import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['dist/**', '.yarn/**', '.pnp.*'],
  },
  {
    files: ['main.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-constant-condition': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]
