import { parseStack } from '../src/index.ts'

const main = () => {
  const stack = `
Error: some long

long message
    at foo (/dir/foo.js:10:5)
    at bar /dir/bar.js:10:5
    at async baz (node:events:104:5)
    at new quux (file:///dir/quux.js:10:5)
`

  const frames = parseStack(stack)
  if (frames[0].file !== '/dir/foo.js') throw new Error(`Expected file to be /dir/foo.js, got ${frames[0].file}`)
  if (frames[0].line !== 10) throw new Error(`Expected line to be 10, got ${frames[0].line}`)
  if (frames[1].file !== '/dir/bar.js') throw new Error(`Expected file to be /dir/bar.js, got ${frames[1].file}`)
  if (frames[2].file !== 'node:events') throw new Error(`Expected file to be node:events, got ${frames[2].file}`)
}

main()
