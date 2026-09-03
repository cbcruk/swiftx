import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import {
  SwiftBinaryNotFoundError,
  bundledBinaryDir,
  resolveSwiftBinary,
  swiftBinaryEnvVar,
} from '../dist/index.js'

/** 테스트 케이스마다 지워지는 임시 디렉터리. */
function tempDir(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'swiftx-resolve-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** 실행 가능한 가짜 바이너리를 만든다. `mtimeSeconds`로 최신도를 조작한다. */
function fakeBinary(file, mtimeSeconds) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, '#!/bin/sh\nexit 0\n')
  chmodSync(file, 0o755)
  if (mtimeSeconds !== undefined) utimesSync(file, mtimeSeconds, mtimeSeconds)
  return file
}

test('환경변수 이름 규약은 SWIFTX_<NAME>_BIN이다', () => {
  assert.equal(swiftBinaryEnvVar('pdf-cli'), 'SWIFTX_PDF_CLI_BIN')
  assert.equal(swiftBinaryEnvVar('vision-ocr-cli'), 'SWIFTX_VISION_OCR_CLI_BIN')
})

test('환경변수가 가리키는 경로를 최우선으로 쓴다', (t) => {
  const dir = tempDir(t)
  const override = fakeBinary(path.join(dir, 'custom', 'pdf-cli'))
  const bundled = path.join(dir, 'bin')
  fakeBinary(path.join(bundled, 'pdf-cli'))

  const resolved = resolveSwiftBinary('pdf-cli', {
    bundledDirs: [bundled],
    env: { SWIFTX_PDF_CLI_BIN: override },
  })

  assert.equal(resolved, override)
})

test('환경변수가 실행 파일을 안 가리키면 조용히 넘어가지 않고 던진다', (t) => {
  const dir = tempDir(t)
  const bundled = path.join(dir, 'bin')
  fakeBinary(path.join(bundled, 'pdf-cli'))

  assert.throws(
    () =>
      resolveSwiftBinary('pdf-cli', {
        bundledDirs: [bundled],
        env: { SWIFTX_PDF_CLI_BIN: path.join(dir, 'missing') },
      }),
    (error) => {
      assert.ok(error instanceof SwiftBinaryNotFoundError)
      assert.match(error.message, /SWIFTX_PDF_CLI_BIN is set but does not point to an executable/)
      return true
    }
  )
})

test('개발 빌드(.build/release)를 찾는다', (t) => {
  const dir = tempDir(t)
  const expected = fakeBinary(path.join(dir, '.build', 'release', 'pdf-cli'))

  assert.equal(resolveSwiftBinary('pdf-cli', { devPackageRoots: [dir], env: {} }), expected)
})

test('release/debug 중 더 최근에 빌드된 쪽을 고른다', (t) => {
  const dir = tempDir(t)
  fakeBinary(path.join(dir, '.build', 'release', 'pdf-cli'), 1_000_000)
  const debug = fakeBinary(path.join(dir, '.build', 'debug', 'pdf-cli'), 2_000_000)

  assert.equal(resolveSwiftBinary('pdf-cli', { devPackageRoots: [dir], env: {} }), debug)
})

test('triple 디렉터리(.build/<triple>/release)의 산출물도 찾는다', (t) => {
  const dir = tempDir(t)
  const expected = fakeBinary(
    path.join(dir, '.build', 'arm64-apple-macosx', 'release', 'pdf-cli'),
    2_000_000
  )

  assert.equal(resolveSwiftBinary('pdf-cli', { devPackageRoots: [dir], env: {} }), expected)
})

test('개발 빌드가 없으면 패키지 동봉본으로 내려간다', (t) => {
  const dir = tempDir(t)
  const bundled = path.join(dir, 'bin')
  const expected = fakeBinary(path.join(bundled, 'pdf-cli'))

  const resolved = resolveSwiftBinary('pdf-cli', {
    devPackageRoots: [path.join(dir, 'swift', 'pdf')],
    bundledDirs: [bundled],
    env: {},
  })

  assert.equal(resolved, expected)
})

test('개발 빌드는 동봉본보다 우선한다', (t) => {
  const dir = tempDir(t)
  const bundled = path.join(dir, 'bin')
  fakeBinary(path.join(bundled, 'pdf-cli'), 3_000_000)
  const dev = fakeBinary(path.join(dir, 'swift', '.build', 'release', 'pdf-cli'), 1_000_000)

  const resolved = resolveSwiftBinary('pdf-cli', {
    devPackageRoots: [path.join(dir, 'swift')],
    bundledDirs: [bundled],
    env: {},
  })

  assert.equal(resolved, dev)
})

test('실행 권한이 없는 파일은 후보에서 제외한다', (t) => {
  const dir = tempDir(t)
  const bundled = path.join(dir, 'bin')
  const candidate = path.join(bundled, 'pdf-cli')
  mkdirSync(bundled, { recursive: true })
  writeFileSync(candidate, 'not executable')
  chmodSync(candidate, 0o644)

  assert.throws(
    () => resolveSwiftBinary('pdf-cli', { bundledDirs: [bundled], env: {} }),
    SwiftBinaryNotFoundError
  )
})

test('못 찾으면 탐색한 경로와 해결 방법을 메시지에 담는다', (t) => {
  const dir = tempDir(t)

  assert.throws(
    () =>
      resolveSwiftBinary('pdf-cli', {
        devPackageRoots: [path.join(dir, 'swift')],
        bundledDirs: [path.join(dir, 'bin')],
        env: {},
      }),
    (error) => {
      assert.ok(error instanceof SwiftBinaryNotFoundError)
      assert.equal(error.binary, 'pdf-cli')
      assert.ok(error.searched.includes(path.join(dir, 'swift', '.build', 'release', 'pdf-cli')))
      assert.ok(error.searched.includes(path.join(dir, 'bin', 'pdf-cli')))
      assert.match(error.message, /swift build -c release/)
      assert.match(error.message, /SWIFTX_PDF_CLI_BIN/)
      return true
    }
  )
})

test('bundledBinaryDir은 dist/ 기준 ../bin을 가리킨다', () => {
  const moduleUrl = pathToFileURL('/pkg/dist/index.js').href

  assert.equal(bundledBinaryDir(moduleUrl), path.join('/pkg', 'bin'))
  assert.equal(bundledBinaryDir(moduleUrl, './vendor'), path.join('/pkg', 'dist', 'vendor'))
})
