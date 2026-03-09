import { prettyErrorTree } from 'pretty-error-tree'

const msg = 'This is a test error in test-project under pretty-error-tree'
const err = prettyErrorTree(new Error(msg))
if (err.indexOf(msg) !== -1) {
  console.log('Test passed.')
  process.exit(0)
} else {
  console.error('Test failed. Expected error message not found in the output.')
  console.error('Output:', err)
  console.error('Expected to find:', msg)
  process.exit(1)
}
