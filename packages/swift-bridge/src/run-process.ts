import { spawn, spawnSync } from 'node:child_process'
import { SwiftCliError, SwiftTimeoutError } from './errors.js'

/** 자식 프로세스의 실행 결과. stdout/stderr는 UTF-8로 모두 수집된 뒤 반환된다. */
export interface ProcessResult {
  stdout: string
  stderr: string
  /** 프로세스 종료 코드. 신호로 죽는 등 코드를 못 받은 경우 -1. */
  exitCode: number
}

/** `runProcess`/`runProcessSync` 공통 옵션. 모두 선택이며 기본값은 "제한 없음"이다. */
export interface RunOptions {
  /** 표준입력으로 흘려보낼 내용. 없으면 빈 stdin으로 즉시 닫는다. */
  stdin?: string | Uint8Array
  cwd?: string
  env?: NodeJS.ProcessEnv
  /** 이 시간을 넘기면 SIGTERM으로 종료시키고 `SwiftTimeoutError`를 던진다. */
  timeoutMs?: number
  /** stdout+stderr 누적 바이트 상한. 넘기면 SIGKILL 후 실패한다. */
  maxBuffer?: number
  /** abort 시 자식 프로세스를 종료시킨다. */
  signal?: AbortSignal
}

/** 종료 코드 검사까지 하는 실행 옵션. */
export interface CheckedRunOptions extends RunOptions {
  /**
   * 종료 코드별 사람이 읽을 메시지. CLI마다 코드 의미가 다르므로
   * (예: translate-cli `2` = 언어팩 미설치) 호출부가 규약을 주입한다.
   */
  exitCodeMessages?: Readonly<Record<number, string>>
}

/**
 * 자식 프로세스를 실행하고 종료될 때까지 기다려 stdout/stderr 전체를 모아 돌려준다.
 * Swift CLI들과 JSON을 주고받는 얇은 shell-out 배선이다.
 *
 * 종료 코드는 검사하지 않는다. 0이 아닐 때 던지길 원하면 `runChecked`를 쓴다.
 *
 * @param command 실행할 바이너리 경로
 * @param args 명령줄 인자
 * @param options 입력/타임아웃/버퍼 상한 등
 * @returns 수집된 stdout/stderr와 종료 코드
 * @throws 스폰 실패, 타임아웃(`SwiftTimeoutError`), `maxBuffer` 초과 시
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions = {}
): Promise<ProcessResult> {
  const { timeoutMs, maxBuffer } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let collected = 0
    let settled = false
    let timedOut = false
    let timer: NodeJS.Timeout | undefined

    const text = (chunks: Buffer[]): string => Buffer.concat(chunks).toString('utf8')
    const settle = (action: () => void): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      action()
    }

    const collect = (chunks: Buffer[], chunk: Buffer): void => {
      chunks.push(chunk)
      collected += chunk.byteLength
      if (maxBuffer !== undefined && collected > maxBuffer) {
        child.kill('SIGKILL')
        settle(() => {
          reject(new Error(`${command} exceeded maxBuffer of ${maxBuffer} bytes`))
        })
      }
    }

    child.stdout.on('data', (chunk: Buffer) => collect(stdoutChunks, chunk))
    child.stderr.on('data', (chunk: Buffer) => collect(stderrChunks, chunk))
    child.on('error', (error) => settle(() => reject(error)))
    child.on('close', (code: number | null) => {
      settle(() => {
        if (timedOut && timeoutMs !== undefined) {
          reject(new SwiftTimeoutError(command, timeoutMs, text(stdoutChunks), text(stderrChunks)))
          return
        }
        resolve({ stdout: text(stdoutChunks), stderr: text(stderrChunks), exitCode: code ?? -1 })
      })
    })

    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, timeoutMs)
    }

    // 자식이 stdin을 다 읽기 전에 죽으면 EPIPE가 올라온다. 진짜 원인은 종료 코드와
    // stderr에 있으므로 여기서 삼키고, close 핸들러가 그 원인을 그대로 전달하게 둔다.
    child.stdin.on('error', () => {})
    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin)
    }
    child.stdin.end()
  })
}

/**
 * `runProcess`의 동기 버전. 이벤트 루프를 막으므로 CLI 진입점처럼
 * 동기 API가 이미 계약인 자리에서만 쓴다.
 *
 * @see runProcess
 */
export function runProcessSync(
  command: string,
  args: readonly string[],
  options: RunOptions = {}
): ProcessResult {
  const result = spawnSync(command, [...args], {
    ...(options.stdin === undefined ? {} : { input: options.stdin }),
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
    ...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }),
  })

  const stdout = result.stdout?.toString('utf8') ?? ''
  const stderr = result.stderr?.toString('utf8') ?? ''

  if (result.error !== undefined) {
    const code = (result.error as NodeJS.ErrnoException).code
    if (code === 'ETIMEDOUT' && options.timeoutMs !== undefined) {
      throw new SwiftTimeoutError(command, options.timeoutMs, stdout, stderr)
    }
    throw result.error
  }

  return { stdout, stderr, exitCode: result.status ?? -1 }
}

/**
 * 종료 코드가 0이 아니면 `SwiftCliError`를 던진다.
 *
 * @param exitCodeMessages 코드별로 덮어쓸 메시지. 없으면 stderr 첫 줄이 메시지가 된다.
 */
export function ensureSuccess(
  result: ProcessResult,
  command: string,
  args: readonly string[],
  exitCodeMessages?: Readonly<Record<number, string>>
): void {
  if (result.exitCode === 0) return
  throw new SwiftCliError(
    { command, args, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
    exitCodeMessages?.[result.exitCode]
  )
}

/** `runProcess` + `ensureSuccess`. Swift CLI 호출의 기본형이다. */
export async function runChecked(
  command: string,
  args: readonly string[],
  options: CheckedRunOptions = {}
): Promise<ProcessResult> {
  const result = await runProcess(command, args, options)
  ensureSuccess(result, command, args, options.exitCodeMessages)
  return result
}

/** `runChecked`의 동기 버전. */
export function runCheckedSync(
  command: string,
  args: readonly string[],
  options: CheckedRunOptions = {}
): ProcessResult {
  const result = runProcessSync(command, args, options)
  ensureSuccess(result, command, args, options.exitCodeMessages)
  return result
}
