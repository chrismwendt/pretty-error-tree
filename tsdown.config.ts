import { defineConfig } from 'tsdown'

export default defineConfig({
  exports: true,
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: 'inline',
  deps: {
    alwaysBundle: '*',
    onlyAllowBundle: false,
  },
})
