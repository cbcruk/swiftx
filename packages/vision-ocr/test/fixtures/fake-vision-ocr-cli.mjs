#!/usr/bin/env node
// vision-ocr-cli의 JSON 계약을 흉내내는 테스트 대역.
// 받은 인자와 stdin 바이트 수를 되돌려주어 호출 조립까지 검증할 수 있다.
import { appendFileSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)

if (process.env.FAKE_LOG !== undefined) {
  appendFileSync(process.env.FAKE_LOG, `${JSON.stringify(args)}\n`)
}
const exitCode = Number(process.env.FAKE_EXIT ?? '0')

if (exitCode !== 0) {
  process.stderr.write(`vision-ocr-cli: ${process.env.FAKE_STDERR ?? 'something went wrong'}\n`)
  process.exit(exitCode)
}

const stdinBytes = args.includes('--stdin') ? readFileSync(0).length : 0
const lines = process.env.FAKE_EMPTY === '1' ? [] : ['첫 줄', 'second line']

process.stdout.write(
  JSON.stringify({
    lines,
    text: lines.join('\n'),
    __args: args,
    __stdinBytes: stdinBytes,
  })
)
