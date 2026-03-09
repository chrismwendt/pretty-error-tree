import { defineConfig } from 'tsdown'

export default defineConfig({
  exports: true,
  format: ['cjs', 'esm'],
  dts: true,
  deps: {
    alwaysBundle: '*',
    onlyAllowBundle: false,
  },
})
