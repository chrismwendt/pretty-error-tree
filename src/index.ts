import * as path from 'path'
import StackTracey from 'stacktracey'
import util from 'util'
import { fileURLToPath } from 'url'

export const installPrettyErrorTree = () => {
  const h = async (err: any) => {
    console.error(await prettyErrorTree(err))
    process.exit(1)
  }

  process.on('uncaughtException', h)
  process.on('unhandledRejection', h)
}

function shortPath(file: string) {
  file = file.startsWith('file://') ? fileURLToPath(file) : file
  return path.relative(process.cwd(), file)
}

type BracketStyle = { one: string; top: string; mid: string; bot: string }

const bracket = (out: string[], style: BracketStyle, color: (s: string) => string): string[] => {
  for (let i = 0; i < out.length; i++) {
    if (i === 0 && i === out.length - 1) out[i] = color(style.one) + out[i]
    else if (i === 0) out[i] = color(style.top) + out[i]
    else if (i === out.length - 1) out[i] = color(style.bot) + out[i]
    else out[i] = color(style.mid) + out[i]
  }

  return out
}

const gray = (s: string) => `\x1b[90m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`

type Frame = {
  file: string
  line: number
  column: number
  sourceLine?: string
  dbg: any
}

const parseStack = async (err: Error): Promise<Frame[]> => {
  const stack = await new StackTracey(err).withSourcesAsync()
  return stack.items.map(entry => ({
    file: entry.file,
    line: entry.line ?? 0,
    column: entry.column ?? 0,
    sourceLine: entry.sourceLine,
    dbg: entry,
  }))
}

export const prettyErrorTree = async (err: Error & { parsedStack?: Frame[] }, prefix?: string): Promise<string> => {
  const lines = await prettyErrorTreeLines(err, prefix)
  return lines.join('\n')
}

const prettyErrorTreeLines = async (err: Error & { parsedStack?: Frame[] }, prefix?: string): Promise<string[]> => {
  const stack = err.parsedStack ?? (await parseStack(err))
  const frames = stack.filter(f => !f.file.startsWith('node:'))

  // name and message
  const headerLines = [`${prefix ?? ''}${gray('[')}${red(err.name)}${gray(']')} ${err.message}`]

  // props
  const known = new Set(['name', 'message', 'stack', 'cause', 'errors', 'parsedStack'])
  const propsObj: Record<string, unknown> = {}
  const errObj = err as Error & Record<string, unknown>
  let hasProps = false
  const propLines: string[] = []
  for (const key of Object.getOwnPropertyNames(err)) {
    if (known.has(key)) continue
    propsObj[key] = errObj[key]
    hasProps = true
  }
  if (hasProps) {
    propLines.push(gray('Properties:'))
    propLines.push(gray(''))
    const inspectLines = util.inspect(propsObj, { colors: true, depth: null, compact: 10 }).split('\n')
    propLines.push(...inspectLines.map(line => '  ' + line))
  }

  // stack trace
  const loc = (item: Frame) => `${shortPath(item.file)}:${item.line}:${item.column}`
  const width = Math.max(...frames.map(f => loc(f).length), 0)
  const style: BracketStyle = { one: '', top: '', mid: '', bot: '' }
  style.top = '╭─▶ '
  style.mid = '├── '
  style.bot = '╰── '
  style.one = '  ▶ '
  const stackLines: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const paddedLoc = `${gray(loc(frame).padEnd(width))}:`
    if (frame.sourceLine) {
      const line = frame.sourceLine.trim()
      const col = frame.column - (frame.sourceLine.length - frame.sourceLine.trimStart().length)
      const before = line.slice(0, col - 1)
      const word = line.slice(col - 1).match(/^(\w+|\()/)?.[0] ?? ''
      const after = line.slice(col - 1 + word.length)
      const lineColored = `${gray(before)}${yellow(word)}${gray(after)}`
      stackLines.push(`${paddedLoc} ${lineColored}`)
    } else {
      stackLines.push(`${paddedLoc} ${gray('// source not available')}`)
    }
  }
  bracket(stackLines, style, gray)

  // AggregateError
  const aggregateLines: string[] = []
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    for (let i = 0; i < err.errors.length; i++) {
      const innerErr = err.errors[i]
      aggregateLines.push(red('│'))
      const inner = await prettyErrorTreeLines(innerErr)
      for (let j = 0; j < inner.length; j++) {
        if (false) continue
        else if (i < err.errors.length - 1 && j === 0) inner[j] = red(`├─`) + inner[j]
        else if (i < err.errors.length - 1 && j > 0) inner[j] = red(`│ `) + inner[j]
        else if (i === err.errors.length - 1 && j === 0) inner[j] = red(`╰─`) + inner[j]
        else if (i === err.errors.length - 1 && j > 0) inner[j] = red(`  `) + inner[j]
        else continue
      }
      aggregateLines.push(...inner)
    }
  }

  // cause
  const causeLines: string[] = []
  if (err.cause instanceof Error) {
    causeLines.push(magenta('│'))
    const cause = await prettyErrorTreeLines(err.cause, 'Caused by ')
    causeLines.push(...cause)
  }

  const out: string[] = []
  out.push(...headerLines)
  if (propLines.length > 0) out.push('')
  out.push(...propLines)
  if (stackLines.length > 0) out.push('')
  out.push(...stackLines)
  for (let i = 1; i < out.length; i++) {
    if (aggregateLines.length > 0) out[i] = red('│ ') + out[i]
    else out[i] = '  ' + out[i]
  }
  out.push(...aggregateLines)
  for (let i = 1; i < out.length; i++) {
    if (causeLines.length > 0) out[i] = magenta('│ ') + out[i]
    else out[i] = '  ' + out[i]
  }
  out.push(...causeLines)
  return out
}
