#!/usr/bin/env node
// pdf-cli의 JSON 계약을 흉내내는 테스트 대역.
// 받은 인자를 `__args`로 되돌려주므로 명령 조립까지 함께 검증할 수 있다.
// FAKE_EXIT / FAKE_STDERR로 실패 경로를 흉내낸다.
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const exitCode = Number(process.env.FAKE_EXIT ?? '0')

if (exitCode !== 0) {
  process.stderr.write(`pdf-cli: ${process.env.FAKE_STDERR ?? 'something went wrong'}\n`)
  process.exit(exitCode)
}

function emit(payload) {
  process.stdout.write(JSON.stringify({ ...payload, __args: args }))
}

switch (args[0]) {
  case 'info':
    emit({ pageCount: 3, hasTextLayer: true })
    break
  case 'extract':
    emit({
      pageCount: 1,
      pages: [
        {
          index: 0,
          width: 612,
          height: 792,
          lines: [{ text: 'Hello', fontSize: 11, bold: false, x: 64, y: 700, width: 40, height: 12 }],
        },
      ],
    })
    break
  case 'structure':
    emit({
      pageCount: 1,
      pages: [
        {
          index: 0,
          width: 612,
          height: 792,
          title: 'Title',
          paragraphs: [
            { text: 'Body', box: { x: 1, y: 2, width: 3, height: 4 }, lineCount: 2 },
          ],
          tables: [],
          lists: [],
        },
      ],
    })
    break
  case 'render': {
    const stdin = readFileSync(0, 'utf8')
    const input = JSON.parse(stdin)
    emit({ output: args[2], pageCount: input.blocks.length, __stdin: input })
    break
  }
  default:
    process.stderr.write(`pdf-cli: unknown command: ${args[0]}\n`)
    process.exit(1)
}
