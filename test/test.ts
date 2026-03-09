import { parseStack } from '../src/index.ts'

const main = () => {
  const stack = `
Error: some long

long message
    at foo (/dir/foo.js:10:5)
    at bar /dir/bar.js:10:5
    at async baz (node:events:104:5)
    at new quux (file:///dir/quux.js:10:5)
    at async foo (test/test.txt:2:17)
`

  const frames = parseStack(stack)
  if (frames[0].file !== '/dir/foo.js') throw new Error(`Expected file to be /dir/foo.js, got ${frames[0].file}`)
  if (frames[0].line !== 10) throw new Error(`Expected line to be 10, got ${frames[0].line}`)
  if (frames[1].file !== '/dir/bar.js') throw new Error(`Expected file to be /dir/bar.js, got ${frames[1].file}`)
  if (frames[2].file !== 'node:events') throw new Error(`Expected file to be node:events, got ${frames[2].file}`)
  if (frames[3].file !== '/dir/quux.js') throw new Error(`Expected file to be /dir/quux.js, got ${frames[3].file}`)
  if (frames[4].file !== 'test/test.txt') throw new Error(`Expected file to be test/test.txt, got ${frames[4].file}`)
  if (frames[4].sourceLine !== 'const x = await foo()')
    throw new Error(`Expected source line to be 'const x = await foo()', got ${frames[4].sourceLine}`)
}

main()
