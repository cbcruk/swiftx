import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'
import { runProcess } from '@cbcruk/swift-bridge'

const here = import.meta.dirname
const cli = path.join(here, '..', 'dist', 'cli.js')
const fake = path.join(here, 'fixtures', 'fake-vision-ocr-cli.mjs')
const logDir = mkdtempSync(path.join(os.tmpdir(), 'swiftx-vision-cli-'))
const log = path.join(logDir, 'calls.log')

after(() => rmSync(logDir, { recursive: true, force: true }))
beforeEach(() => rmSync(log, { force: true }))

/** 대역이 받은 인자들. */
function calls() {
  try {
    return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

function runCli(args, extraEnv = {}) {
  return runProcess(process.execPath, [cli, ...args], {
    env: { ...process.env, SWIFTX_VISION_OCR_CLI_BIN: fake, FAKE_LOG: log, ...extraEnv },
  })
}

test('파일을 주면 인식 텍스트를 stdout으로 낸다', async () => {
  const result = await runCli(['shot.png', '--no-copy'])

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, '첫 줄\nsecond line\n')
})

test('파일 경로는 절대 경로로 바꿔 넘긴다', async () => {
  await runCli(['shot.png', '--no-copy'])

  assert.deepEqual(calls(), [[path.resolve('shot.png')]])
})

test('파일이 없으면 클립보드를 읽는다', async () => {
  await runCli(['--no-copy'])

  assert.deepEqual(calls(), [['--clipboard']])
})

test('--languages를 그대로 전달한다', async () => {
  await runCli(['--no-copy', '--languages', 'ja-JP,en-US'])

  assert.deepEqual(calls(), [['--clipboard', '--languages', 'ja-JP,en-US']])
})

test('인식된 글자가 없으면 종료 코드 1로 알린다', async () => {
  const result = await runCli(['--no-copy'], { FAKE_EMPTY: '1' })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /No text recognized from the image\./)
})

test('클립보드가 비면 사람이 읽을 안내를 낸다', async () => {
  const result = await runCli(['--no-copy'], {
    FAKE_EXIT: '5',
    FAKE_STDERR: 'no image found in clipboard',
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /No image found in clipboard\./)
})

test('그 밖의 실패는 OCR failed로 감싸 알린다', async () => {
  const result = await runCli(['missing.png', '--no-copy'], {
    FAKE_EXIT: '2',
    FAKE_STDERR: 'failed to load image',
  })

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /OCR failed: .*failed to load image/)
})

test('클립보드 복사가 실패해도 결과와 종료 코드는 유지된다', async () => {
  // 이 패키지는 os: ["darwin"]이라 실행 환경에는 pbcopy가 항상 있다.
  // 반드시 실패하는 스텁을 PATH 앞에 끼워 "복사 실패"를 결정론적으로 만든다.
  const stubDir = mkdtempSync(path.join(os.tmpdir(), 'swiftx-pbcopy-'))
  after(() => rmSync(stubDir, { recursive: true, force: true }))
  const stub = path.join(stubDir, 'pbcopy')
  writeFileSync(stub, '#!/bin/sh\nexit 1\n')
  chmodSync(stub, 0o755)

  const result = await runCli(['shot.png'], {
    PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ''}`,
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, '첫 줄\nsecond line\n')
  assert.match(result.stderr, /clipboard copy failed:/)
})

test('--help는 사용법을 내고 0으로 끝난다', async () => {
  const result = await runCli(['--help'])

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /usage: vision-ocr \[file\]/)
})

test('--version은 패키지 버전을 낸다', async () => {
  const result = await runCli(['--version'])
  const { version } = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'))

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout.trim(), version)
})

test('모르는 플래그는 사용 오류로 끝난다', async () => {
  const result = await runCli(['--nope'])

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /unknown argument: --nope/)
})
