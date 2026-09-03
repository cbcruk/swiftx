import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SwiftCliError,
  SwiftTimeoutError,
  runChecked,
  runCheckedSync,
  runProcess,
  runProcessSync,
} from '../dist/index.js'

/** 테스트용 자식 프로세스: 현재 노드로 인라인 스크립트를 실행한다. */
function nodeArgs(source) {
  return ['-e', source]
}

test('stdout, stderr, 종료 코드를 모두 수집한다', async () => {
  const result = await runProcess(
    process.execPath,
    nodeArgs('process.stdout.write("out"); process.stderr.write("err"); process.exit(7)')
  )

  assert.equal(result.stdout, 'out')
  assert.equal(result.stderr, 'err')
  assert.equal(result.exitCode, 7)
})

test('stdin을 자식에게 흘려보낸다', async () => {
  const result = await runProcess(
    process.execPath,
    nodeArgs('process.stdin.pipe(process.stdout)'),
    { stdin: '안녕 swiftx' }
  )

  assert.equal(result.stdout, '안녕 swiftx')
  assert.equal(result.exitCode, 0)
})

test('stdin을 읽지 않고 먼저 죽는 자식에서도 EPIPE로 터지지 않는다', async () => {
  const result = await runProcess(
    process.execPath,
    nodeArgs('process.stderr.write("bail"); process.exit(2)'),
    { stdin: 'x'.repeat(1024 * 1024) }
  )

  assert.equal(result.exitCode, 2)
  assert.equal(result.stderr, 'bail')
})

test('멀티바이트 출력이 청크 경계에서 깨지지 않는다', async () => {
  const result = await runProcess(
    process.execPath,
    nodeArgs('process.stdout.write("한글".repeat(50000))')
  )

  assert.equal(result.stdout, '한글'.repeat(50000))
})

test('runChecked는 0이 아닌 종료 코드에 SwiftCliError를 던진다', async () => {
  await assert.rejects(
    () =>
      runChecked(
        process.execPath,
        nodeArgs('process.stderr.write("cannot open PDF: a.pdf\\n"); process.exit(2)')
      ),
    (error) => {
      assert.ok(error instanceof SwiftCliError)
      assert.equal(error.exitCode, 2)
      assert.equal(error.stderr, 'cannot open PDF: a.pdf\n')
      assert.match(error.message, /exited with code 2: cannot open PDF: a\.pdf/)
      return true
    }
  )
})

test('exitCodeMessages로 종료 코드별 메시지를 덮어쓴다', async () => {
  await assert.rejects(
    () =>
      runChecked(process.execPath, nodeArgs('process.exit(2)'), {
        exitCodeMessages: { 2: 'language pack not installed' },
      }),
    (error) => {
      assert.equal(error.message, 'language pack not installed')
      assert.equal(error.exitCode, 2)
      return true
    }
  )
})

test('runChecked는 성공 시 결과를 그대로 돌려준다', async () => {
  const result = await runChecked(process.execPath, nodeArgs('process.stdout.write("ok")'))
  assert.equal(result.stdout, 'ok')
})

test('timeoutMs를 넘기면 SwiftTimeoutError로 끝난다', async () => {
  await assert.rejects(
    () => runProcess(process.execPath, nodeArgs('setTimeout(() => {}, 10000)'), { timeoutMs: 150 }),
    (error) => {
      assert.ok(error instanceof SwiftTimeoutError)
      assert.equal(error.timeoutMs, 150)
      assert.match(error.message, /timed out after 150ms/)
      return true
    }
  )
})

test('timeoutMs 안에 끝나면 타임아웃 타이머가 결과를 막지 않는다', async () => {
  const result = await runProcess(process.execPath, nodeArgs('process.stdout.write("fast")'), {
    timeoutMs: 5000,
  })
  assert.equal(result.stdout, 'fast')
})

test('maxBuffer를 넘기면 실패한다', async () => {
  await assert.rejects(
    () =>
      runProcess(process.execPath, nodeArgs('process.stdout.write("x".repeat(200000))'), {
        maxBuffer: 1024,
      }),
    /exceeded maxBuffer of 1024 bytes/
  )
})

test('AbortSignal로 실행을 취소할 수 있다', async () => {
  const controller = new AbortController()
  const pending = runProcess(process.execPath, nodeArgs('setTimeout(() => {}, 10000)'), {
    signal: controller.signal,
  })
  controller.abort()

  await assert.rejects(() => pending)
})

test('cwd와 env가 자식에게 전달된다', async () => {
  const result = await runProcess(
    process.execPath,
    nodeArgs('process.stdout.write(process.cwd() + "|" + process.env.SWIFTX_PROBE)'),
    { cwd: import.meta.dirname, env: { ...process.env, SWIFTX_PROBE: 'yes' } }
  )

  const [cwd, probe] = result.stdout.split('|')
  assert.equal(cwd, import.meta.dirname)
  assert.equal(probe, 'yes')
})

test('runProcessSync도 같은 결과를 돌려준다', () => {
  const result = runProcessSync(
    process.execPath,
    nodeArgs('process.stdin.pipe(process.stdout); process.exitCode = 0'),
    { stdin: 'sync' }
  )

  assert.equal(result.stdout, 'sync')
  assert.equal(result.exitCode, 0)
})

test('runCheckedSync도 SwiftCliError를 던진다', () => {
  assert.throws(
    () => runCheckedSync(process.execPath, nodeArgs('process.exit(3)')),
    (error) => {
      assert.ok(error instanceof SwiftCliError)
      assert.equal(error.exitCode, 3)
      return true
    }
  )
})

test('존재하지 않는 바이너리는 스폰 에러로 reject된다', async () => {
  await assert.rejects(() => runProcess('/nonexistent/swiftx-binary', []), { code: 'ENOENT' })
})

test('stderr의 <tool>: 접두사는 메시지에서 중복되지 않는다', async () => {
  const tool = process.execPath
  const name = tool.split('/').pop()

  await assert.rejects(
    () =>
      runChecked(tool, nodeArgs(`process.stderr.write("${name}: cannot open PDF\\n"); process.exit(2)`)),
    (error) => {
      assert.equal(error.message, `${name} exited with code 2: cannot open PDF`)
      return true
    }
  )
})
