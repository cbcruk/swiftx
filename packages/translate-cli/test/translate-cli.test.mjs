import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, beforeEach } from 'node:test'
import { SwiftCliError } from '@cbcruk/swift-bridge'
import {
  TranslateExitCode,
  checkAvailability,
  translate,
  translateOnce,
} from '../dist/index.js'

const fake = path.join(import.meta.dirname, 'fixtures', 'fake-translate-cli.mjs')
const previous = process.env.SWIFTX_TRANSLATE_CLI_BIN
const logDir = mkdtempSync(path.join(os.tmpdir(), 'swiftx-translate-'))
const log = path.join(logDir, 'calls.log')

/** 대역이 기록한 호출들. 파일이 없으면 한 번도 실행되지 않은 것이다. */
function calls() {
  try {
    return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

before(() => {
  process.env.SWIFTX_TRANSLATE_CLI_BIN = fake
  process.env.FAKE_LOG = log
})

beforeEach(() => {
  rmSync(log, { force: true })
})

after(() => {
  if (previous === undefined) delete process.env.SWIFTX_TRANSLATE_CLI_BIN
  else process.env.SWIFTX_TRANSLATE_CLI_BIN = previous
  delete process.env.FAKE_LOG
  rmSync(logDir, { recursive: true, force: true })
})

test('checkAvailability는 --check와 언어 쌍을 넘긴다', async () => {
  const result = await checkAvailability({ source: 'en', target: 'ko' })

  assert.equal(result.status, 'installed')
  assert.deepEqual(calls(), [['--source', 'en', '--target', 'ko', '--check']])
})

test('언어 쌍의 기본값은 en -> ko다', async () => {
  await checkAvailability()

  assert.deepEqual(calls()[0], ['--source', 'en', '--target', 'ko', '--check'])
})

test('translateOnce는 NDJSON 결과를 그대로 돌려준다', async () => {
  const lines = await translateOnce(['Hello', 'World'])

  assert.deepEqual(lines, [
    { index: 0, sourceText: 'Hello', targetText: '[ko] Hello' },
    { index: 1, sourceText: 'World', targetText: '[ko] World' },
  ])
})

test('translate는 입력 순서의 번역문만 돌려준다', async () => {
  const translated = await translate(['Hello', 'World'])

  assert.deepEqual(translated, ['[ko] Hello', '[ko] World'])
})

test('translate는 chunkSize 단위로 나눠 순차 호출한다', async () => {
  const texts = ['a', 'b', 'c', 'd', 'e']
  const translated = await translate(texts, { chunkSize: 2 })

  assert.deepEqual(translated, texts.map((text) => `[ko] ${text}`))
  assert.equal(calls().length, 3)
})

test('CLI가 순서를 바꿔 뱉어도 index로 되돌린다', async () => {
  process.env.FAKE_SHUFFLE = '1'
  after(() => delete process.env.FAKE_SHUFFLE)

  const translated = await translate(['a', 'b', 'c'])

  assert.deepEqual(translated, ['[ko] a', '[ko] b', '[ko] c'])
})

test('결과 개수가 모자라면 조용히 넘어가지 않고 던진다', async () => {
  process.env.FAKE_DROP = '1'
  after(() => delete process.env.FAKE_DROP)

  await assert.rejects(
    () => translate(['a', 'b', 'c']),
    /translate-cli returned 2 results for 3 inputs/
  )
})

test('onProgress는 누적 개수와 전체 개수를 받는다', async () => {
  const progress = []
  await translate(['a', 'b', 'c', 'd', 'e'], {
    chunkSize: 2,
    onProgress: (completed, total) => progress.push([completed, total]),
  })

  assert.deepEqual(progress, [[2, 5], [4, 5], [5, 5]])
})

test('빈 입력은 프로세스를 띄우지 않는다', async () => {
  assert.deepEqual(await translate([]), [])
  assert.deepEqual(calls(), [])
})

test('chunkSize가 1 미만이면 RangeError', async () => {
  await assert.rejects(() => translate(['a'], { chunkSize: 0 }), RangeError)
})

test('언어팩 미설치는 종료 코드 5로 구분된다', async () => {
  process.env.FAKE_EXIT = '5'
  process.env.FAKE_STDERR = 'language pair en->ko is supported but not installed.'
  after(() => {
    delete process.env.FAKE_EXIT
    delete process.env.FAKE_STDERR
  })

  await assert.rejects(
    () => translate(['a']),
    (error) => {
      assert.ok(error instanceof SwiftCliError)
      assert.equal(error.exitCode, TranslateExitCode.languagePackMissing)
      return true
    }
  )
})
