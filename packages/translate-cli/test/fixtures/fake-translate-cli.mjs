#!/usr/bin/env node
// translate-cli의 JSON 계약을 흉내내는 테스트 대역.
// FAKE_LOG에 호출마다 인자를 한 줄씩 기록해 청크 분할을 검증할 수 있게 한다.
// FAKE_EXIT / FAKE_STDERR / FAKE_SHUFFLE / FAKE_DROP으로 실패·경계 상황을 만든다.
import { appendFileSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)

if (process.env.FAKE_LOG !== undefined) {
  appendFileSync(process.env.FAKE_LOG, `${JSON.stringify(args)}\n`)
}

const exitCode = Number(process.env.FAKE_EXIT ?? '0')
if (exitCode !== 0) {
  process.stderr.write(`translate-cli: ${process.env.FAKE_STDERR ?? 'something went wrong'}\n`)
  process.exit(exitCode)
}

function flag(name, fallback) {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

const source = flag('--source', 'en')
const target = flag('--target', 'ko')

if (args.includes('--check')) {
  process.stdout.write(`${JSON.stringify({ status: 'installed', source, target })}\n`)
  process.exit(0)
}

const texts = JSON.parse(readFileSync(0, 'utf8'))
let lines = texts.map((text, index) => ({
  index,
  sourceText: text,
  targetText: `[${target}] ${text}`,
}))

if (process.env.FAKE_SHUFFLE === '1') lines = [...lines].reverse()
if (process.env.FAKE_DROP === '1') lines = lines.slice(0, -1)

for (const line of lines) {
  process.stdout.write(`${JSON.stringify(line)}\n`)
}
