import { spawn } from 'child_process'
import { once } from 'node:events'
import { installPrettyErrorTree, prettyErrorTree } from '../src/index'

const main = async () => {
  installPrettyErrorTree()

  await using stack = new AsyncDisposableStack()

  const controller = stack.adopt(new AbortController(), c => {
    console.log('cleanup: aborting process')
    c.abort()
  })

  const cp = spawn('sleep', ['1'], { signal: controller.signal })

  stack.adopt(cp, async p => {
    console.log('cleanup: waiting for process exit')
    await once(p, 'exit')

    // simulate cleanup failure
    throw new Error('process cleanup failed')
  })

  // main failure
  throw new Error('main failure')
}

main()
