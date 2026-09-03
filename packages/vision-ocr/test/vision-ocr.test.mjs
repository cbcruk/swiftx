import assert from 'node:assert/strict'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { SwiftCliError } from '@cbcruk/swift-bridge'
import {
  VisionExitCode,
  recognize,
  recognizeSync,
  recognizeText,
  recognizeTextFromClipboard,
  recognizeTextFromFile,
  visionOcrBinary,
} from '../dist/index.js'

const fake = path.join(import.meta.dirname, 'fixtures', 'fake-vision-ocr-cli.mjs')
const previous = process.env.SWIFTX_VISION_OCR_CLI_BIN

before(() => {
  process.env.SWIFTX_VISION_OCR_CLI_BIN = fake
})

after(() => {
  if (previous === undefined) delete process.env.SWIFTX_VISION_OCR_CLI_BIN
  else process.env.SWIFTX_VISION_OCR_CLI_BIN = previous
  delete process.env.FAKE_EXIT
  delete process.env.FAKE_STDERR
  delete process.env.FAKE_EMPTY
})

test('visionOcrBinary는 환경변수를 따른다', () => {
  assert.equal(visionOcrBinary(), fake)
  assert.equal(visionOcrBinary('/opt/vision-ocr-cli'), '/opt/vision-ocr-cli')
})

test('파일 출처는 경로를 위치 인자로 넘긴다', async () => {
  const result = await recognize({ file: '/tmp/shot.png' })

  assert.deepEqual(result.lines, ['첫 줄', 'second line'])
  assert.equal(result.text, '첫 줄\nsecond line')
  assert.deepEqual(result.__args, ['/tmp/shot.png'])
})

test('클립보드 출처는 --clipboard를 넘긴다', async () => {
  const result = await recognize({ clipboard: true })

  assert.deepEqual(result.__args, ['--clipboard'])
})

test('버퍼 출처는 --stdin으로 이미지 바이트를 흘려보낸다', async () => {
  const buffer = Buffer.from('89504e470d0a1a0a', 'hex')
  const result = await recognize({ buffer })

  assert.deepEqual(result.__args, ['--stdin'])
  assert.equal(result.__stdinBytes, buffer.length)
})

test('languages는 쉼표로 이어 --languages로 넘어간다', async () => {
  const result = await recognize({ file: '/tmp/shot.png' }, { languages: ['ja-JP', 'en-US'] })

  assert.deepEqual(result.__args, ['/tmp/shot.png', '--languages', 'ja-JP,en-US'])
})

test('빈 languages는 플래그를 만들지 않는다', async () => {
  const result = await recognize({ file: '/tmp/shot.png' }, { languages: [] })

  assert.deepEqual(result.__args, ['/tmp/shot.png'])
})

test('recognizeSync도 같은 결과를 돌려준다', () => {
  assert.equal(recognizeSync({ clipboard: true }).text, '첫 줄\nsecond line')
})

test('1.x 호환 함수들은 동기로 문자열을 돌려준다', () => {
  assert.equal(recognizeText(Buffer.from('png')), '첫 줄\nsecond line')
  assert.equal(recognizeTextFromFile('/tmp/shot.png'), '첫 줄\nsecond line')
  assert.equal(recognizeTextFromClipboard(), '첫 줄\nsecond line')
})

test('인식된 글자가 없어도 실패가 아니다', async () => {
  process.env.FAKE_EMPTY = '1'
  after(() => delete process.env.FAKE_EMPTY)

  const result = await recognize({ clipboard: true })

  assert.deepEqual(result.lines, [])
  assert.equal(result.text, '')
})

test('빈 클립보드는 종료 코드 5로 구분된다', async () => {
  process.env.FAKE_EXIT = '5'
  process.env.FAKE_STDERR = 'no image found in clipboard'
  after(() => {
    delete process.env.FAKE_EXIT
    delete process.env.FAKE_STDERR
  })

  await assert.rejects(
    () => recognize({ clipboard: true }),
    (error) => {
      assert.ok(error instanceof SwiftCliError)
      assert.equal(error.exitCode, VisionExitCode.clipboardEmpty)
      return true
    }
  )
})
