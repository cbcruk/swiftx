#!/usr/bin/env node
import { SwiftCliError } from '@cbcruk/swift-bridge'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { VisionExitCode, recognize } from './index.js'

interface Options {
  file?: string
  copy: boolean
  languages?: string[]
}

function readVersion(): string {
  try {
    const manifest = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    return (JSON.parse(manifest) as { version?: string }).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function printUsage(): void {
  process.stdout.write(
    `usage: vision-ocr [file] [--no-copy] [--languages ko-KR,en-US]\n\n` +
      `Extracts text from an image using the macOS Vision framework.\n` +
      `Reads the clipboard when no file is given, and copies the result back\n` +
      `to the clipboard unless --no-copy is passed.\n`
  )
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = { copy: true }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--no-copy':
        options.copy = false
        break
      case '--languages': {
        const value = argv[index + 1]
        if (value === undefined) fail('--languages requires a value')
        options.languages = value.split(',')
        index += 1
        break
      }
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
      case '--version':
      case '-V':
        process.stdout.write(`${readVersion()}\n`)
        process.exit(0)
      default:
        if (argument === undefined || argument.startsWith('-')) {
          fail(`unknown argument: ${String(argument)}`)
        }
        if (options.file !== undefined) fail('expected at most one file argument')
        options.file = argument
    }
  }

  return options
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

/**
 * 결과를 클립보드로 되돌려 넣는다.
 *
 * 실패해도 종료 코드를 바꾸지 않는다. 텍스트는 이미 stdout으로 나갔으므로,
 * 복사 실패 때문에 파이프라인 전체를 실패시키는 편이 더 나쁘다.
 */
function copyToClipboard(text: string): void {
  try {
    execFileSync('pbcopy', { input: text })
  } catch (error) {
    process.stderr.write(
      `clipboard copy failed: ${error instanceof Error ? error.message : String(error)}\n`
    )
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const source =
    options.file === undefined
      ? ({ clipboard: true } as const)
      : ({ file: path.resolve(options.file) } as const)

  let text: string
  try {
    const result = await recognize(source, {
      ...(options.languages === undefined ? {} : { languages: options.languages }),
    })
    text = result.text
  } catch (error) {
    if (error instanceof SwiftCliError && error.exitCode === VisionExitCode.clipboardEmpty) {
      fail('No image found in clipboard.')
    }
    fail(`OCR failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (text.trim() === '') {
    fail('No text recognized from the image.')
  }

  process.stdout.write(`${text}\n`)

  if (options.copy) {
    copyToClipboard(text)
  }
}

await main()
