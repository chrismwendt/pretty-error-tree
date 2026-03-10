import * as path from 'path'
import util from 'util'
import { fileURLToPath } from 'url'
import getSource from 'get-source'
import fs from 'fs'

export const installPrettyErrorTree = () => {
  const h = (err: any) => {
    console.error(prettyErrorTree(err))
    process.exit(1)
  }

  process.on('uncaughtException', h)
  process.on('unhandledRejection', h)
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

export type Frame = {
  file: string
  line: number
  column: number
  sourceLine?: string
  callee: string
}

export const parseStack = (stack: string): Frame[] => {
  const fileCache = new Map<string, string[]>()

  function getSourceLine(file: string, line: number): string | undefined {
    let lines = fileCache.get(file)

    if (!lines) {
      try {
        lines = fs.readFileSync(file, 'utf8').split('\n')
      } catch {
        lines = []
      }
      fileCache.set(file, lines)
    }

    return lines[line - 1]
  }

  return stack.split('\n').flatMap((stackLine): Frame[] => {
    const match1 = stackLine.match(/^\s*at\s+(.+?)\s+\(([^\s]+):(\d+):(\d+)\)$/)
    const match2 = stackLine.match(/^\s*at\s+(.+?)\s+([^\s]+):(\d+):(\d+)$/)
    const match = match1 ?? match2
    if (!match) return []

    const [, callee, fileMaybeUrl, lineStr, columnStr] = match
    const line = parseInt(lineStr, 10)
    const column = parseInt(columnStr, 10)

    const file = fileMaybeUrl.startsWith('file://') ? fileURLToPath(fileMaybeUrl) : fileMaybeUrl

    const sourceLine = getSourceLine(file, line)

    return [{ file, line, column, sourceLine, callee }]
  })
}

export type ErrorExtra = Error & { parsedStack?: Frame[]; prefix?: string }

export const prettyErrorTree = (err: ErrorExtra): string => {
  const lines = prettyErrorTreeLines(err)
  return lines.join('\n')
}

const prettyErrorTreeLines = (err: ErrorExtra, prefix?: string): string[] => {
  if (!err || typeof err !== 'object') return [`${String(err)}`]

  const stack = err.parsedStack ?? (err.stack ? parseStack(err.stack) : [])
  const frames = stack

  // name and message
  const headerLines = [`${prefix ?? ''}${gray('[')}${red(err.name)}${gray(']')} ${err.message.trim()}`]

  // props
  const known = new Set(['name', 'message', 'stack', 'cause', 'errors', 'parsedStack', 'prefix', 'error', 'suppressed'])
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
    const inspectLines = util.inspect(propsObj, { colors: true, depth: null, compact: 10 }).split('\n')
    propLines.push(gray('Properties: ') + inspectLines[0])
    propLines.push(...inspectLines.slice(1))
  }

  // stack trace
  const loc = (item: Frame) => `${path.relative(process.cwd(), item.file)}:${item.line}:${item.column}`
  const locWidth = Math.max(...frames.map(f => loc(f).length), 0)
  const calleeWidth = Math.max(...frames.map(f => f.callee.length), 0)
  const style: BracketStyle = { one: '', top: '', mid: '', bot: '' }
  style.top = '╭─▶ '
  style.mid = '├── '
  style.bot = '╰── '
  style.one = '  ▶ '
  const stackLines: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const paddedLoc = `${gray(loc(frame).padEnd(locWidth))}:`
    const paddedCallee = `${gray(frame.callee.padEnd(calleeWidth))}`
    if (frame.sourceLine) {
      const line = frame.sourceLine.trim()
      const col = frame.column - (frame.sourceLine.length - frame.sourceLine.trimStart().length)
      const before = line.slice(0, col - 1)
      const word = line.slice(col - 1).match(/^(\w+|\()/)?.[0] ?? ''
      const after = line.slice(col - 1 + word.length)
      const lineColored = `${gray(before)}${yellow(word)}${gray(after)}`
      stackLines.push(`${gray('at')} ${paddedCallee} ${paddedLoc} ${lineColored}`)
    } else {
      stackLines.push(`${gray('at')} ${paddedCallee} ${paddedLoc} ${gray('// source not available')}`)
    }
  }
  bracket(stackLines, style, gray)

  const printInner = (errors: Array<{ error: Error; prefix?: string }>): string[] => {
    const out: string[] = []
    for (let i = 0; i < errors.length; i++) {
      const innerErr = errors[i]
      out.push(red('│'))
      const inner = prettyErrorTreeLines(innerErr.error, innerErr.prefix)
      for (let j = 0; j < inner.length; j++) {
        if (false) continue
        else if (i < errors.length - 1 && j === 0) inner[j] = red(`├─`) + inner[j]
        else if (i < errors.length - 1 && j > 0) inner[j] = red(`│ `) + inner[j]
        else if (i === errors.length - 1 && j === 0) inner[j] = red(`╰─`) + inner[j]
        else if (i === errors.length - 1 && j > 0) inner[j] = red(`  `) + inner[j]
        else continue
      }
      out.push(...inner)
    }
    return out
  }

  const innerErrorLines: string[] = []

  // AggregateError
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    innerErrorLines.push(...printInner(err.errors.map(error => ({ error }))))
  }

  // SuppressedError
  if (err instanceof SuppressedError) {
    innerErrorLines.push(
      ...printInner([
        { error: err.error, prefix: 'Suppressed by ' },
        { error: err.suppressed, prefix: 'Suppressed ' },
      ])
    )
  }

  // cause
  const causeLines: string[] = []
  if (err.cause) {
    causeLines.push(magenta('│'))
    const cause: string[] = (() => {
      if (err.cause instanceof Error) {
        return prettyErrorTreeLines(err.cause, 'Caused by: ')
      } else {
        return [`Caused by: ${String(err.cause)}`]
      }
    })()
    causeLines.push(...cause)
  }

  const out: string[] = []
  out.push(...headerLines)
  if (propLines.length > 0) out.push('')
  out.push(...propLines)
  if (stackLines.length > 0) out.push('')
  out.push(...stackLines)
  for (let i = 1; i < out.length; i++) {
    if (innerErrorLines.length > 0) out[i] = red('│ ') + out[i]
    else out[i] = '  ' + out[i]
  }
  out.push(...innerErrorLines)
  for (let i = 1; i < out.length; i++) {
    if (causeLines.length > 0) out[i] = magenta('│ ') + out[i]
    else out[i] = '  ' + out[i]
  }
  out.push(...causeLines)
  return out
}
