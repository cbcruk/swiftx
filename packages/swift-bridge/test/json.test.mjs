import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SwiftOutputError,
  parseJson,
  parseJsonLines,
  runJson,
  runJsonLines,
  runJsonSync,
} from '../dist/index.js'

test('parseJson은 문서 하나를 파싱한다', () => {
  assert.deepEqual(parseJson('{"pageCount":3}', 'pdf-cli'), { pageCount: 3 })
})

test('parseJson은 JSON이 아니면 출처와 원문을 담아 던진다', () => {
  assert.throws(
    () => parseJson('pdf-cli: cannot open PDF', 'pdf-cli'),
    (error) => {
      assert.ok(error instanceof SwiftOutputError)
      assert.match(error.message, /pdf-cli did not print valid JSON: pdf-cli: cannot open PDF/)
      assert.equal(error.raw, 'pdf-cli: cannot open PDF')
      assert.ok(error.cause instanceof SyntaxError)
      return true
    }
  )
})

test('parseJson의 에러 메시지는 원문이 길면 잘린다', () => {
  const raw = 'x'.repeat(1000)
  assert.throws(
    () => parseJson(raw, 'pdf-cli'),
    (error) => {
      assert.ok(error.message.includes('…'))
      assert.ok(error.message.length < 500)
      assert.equal(error.raw, raw)
      return true
    }
  )
})

test('parseJsonLines는 NDJSON을 배열로 파싱하고 빈 줄을 건너뛴다', () => {
  const text = '{"index":0}\n\n{"index":1}\n'
  assert.deepEqual(parseJsonLines(text, 'translate-cli'), [{ index: 0 }, { index: 1 }])
})

test('parseJsonLines는 CRLF 줄바꿈도 처리한다', () => {
  assert.deepEqual(parseJsonLines('{"a":1}\r\n{"a":2}\r\n', 'translate-cli'), [{ a: 1 }, { a: 2 }])
})

test('parseJsonLines는 깨진 줄의 번호를 알려준다', () => {
  assert.throws(
    () => parseJsonLines('{"index":0}\nnot json\n', 'translate-cli'),
    (error) => {
      assert.ok(error instanceof SwiftOutputError)
      assert.match(error.message, /non-JSON line at line 2: not json/)
      return true
    }
  )
})

test('parseJsonLines는 빈 출력에 빈 배열을 돌려준다', () => {
  assert.deepEqual(parseJsonLines('', 'translate-cli'), [])
})

test('runJson은 실행부터 파싱까지 한 번에 한다', async () => {
  const value = await runJson(process.execPath, [
    '-e',
    'process.stdout.write(JSON.stringify({ pageCount: 2, pages: [] }))',
  ])

  assert.deepEqual(value, { pageCount: 2, pages: [] })
})

test('runJson은 CLI가 실패하면 파싱 전에 SwiftCliError를 던진다', async () => {
  await assert.rejects(
    () => runJson(process.execPath, ['-e', 'process.stderr.write("boom"); process.exit(2)']),
    { name: 'SwiftCliError', exitCode: 2 }
  )
})

test('runJsonLines는 NDJSON 출력을 배열로 돌려준다', async () => {
  const lines = await runJsonLines(process.execPath, [
    '-e',
    'process.stdout.write(\'{"index":0}\\n{"index":1}\\n\')',
  ])

  assert.deepEqual(lines, [{ index: 0 }, { index: 1 }])
})

test('runJsonSync도 파싱된 값을 돌려준다', () => {
  const value = runJsonSync(process.execPath, ['-e', 'process.stdout.write(\'{"ok":true}\')'])
  assert.deepEqual(value, { ok: true })
})
