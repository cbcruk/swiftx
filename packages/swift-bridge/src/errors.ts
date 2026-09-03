import path from 'node:path'

/** 스폰된 Swift CLI의 실행 결과 요약. 에러 객체에 그대로 실려 호출부로 전달된다. */
export interface SwiftCliErrorInfo {
  command: string
  args: readonly string[]
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Swift CLI가 0이 아닌 코드로 종료했을 때 던져지는 에러.
 *
 * 각 CLI는 종료 코드로 실패 원인을 구분하므로(예: translate-cli의 `2` = 언어팩 미설치),
 * `exitCode`를 그대로 노출해 호출부가 분기할 수 있게 한다. 사람이 읽을 메시지는
 * `runChecked`의 `exitCodeMessages`로 코드별로 덮어쓸 수 있다.
 */
export class SwiftCliError extends Error {
  override readonly name = 'SwiftCliError'
  readonly command: string
  readonly args: readonly string[]
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string

  constructor(info: SwiftCliErrorInfo, message?: string) {
    super(message ?? defaultMessage(info))
    this.command = info.command
    this.args = info.args
    this.exitCode = info.exitCode
    this.stdout = info.stdout
    this.stderr = info.stderr
  }
}

/** 실패 원인 한 줄을 붙여 "무엇이 왜 실패했는지"가 한 줄로 보이게 만든다. */
function defaultMessage(info: SwiftCliErrorInfo): string {
  const tool = path.basename(info.command)
  const detail = failureLine(info.stderr, tool)
  const suffix = detail === '' ? '' : `: ${detail}`
  return `${tool} exited with code ${info.exitCode}${suffix}`
}

/**
 * stderr에서 실패 원인 줄을 고른다.
 *
 * "첫 줄"만 보면 안 되는 이유는, Apple 프레임워크가 같은 stderr에 자기 진단을 먼저
 * 흘리기 때문이다. 예를 들어 깨진 PDF를 열면 CoreGraphics가
 * `CoreGraphics PDF has logged an error…`를 먼저 쓰고, 진짜 원인인
 * `pdf-cli: cannot open PDF: …`는 그 다음 줄에 온다.
 *
 * swiftx CLI는 원인을 `<tool>: `로 시작하는 줄에 쓰기로 약속했으므로(Swift 쪽 `fail`)
 * 그 줄을 먼저 찾고, 없을 때만 첫 비어 있지 않은 줄로 물러선다. 도구 이름은 메시지
 * 앞에 이미 쓰고 있으므로 접두사는 떼어낸다.
 */
function failureLine(stderr: string, tool: string): string {
  const lines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  const prefix = `${tool}: `
  const own = lines.find((line) => line.startsWith(prefix))

  return own === undefined ? (lines[0] ?? '') : own.slice(prefix.length)
}

/**
 * 실행할 Swift 바이너리를 어느 후보 경로에서도 찾지 못했을 때 던져진다.
 * `searched`에 탐색한 경로가 순서대로 담기므로 그대로 안내 메시지에 쓸 수 있다.
 */
export class SwiftBinaryNotFoundError extends Error {
  override readonly name = 'SwiftBinaryNotFoundError'
  readonly binary: string
  readonly searched: readonly string[]

  constructor(binary: string, searched: readonly string[], hint?: string) {
    const lines = searched.map((candidate) => `  - ${candidate}`).join('\n')
    super(
      `${binary} binary not found. Searched:\n${lines}` +
        (hint === undefined ? '' : `\n${hint}`)
    )
    this.binary = binary
    this.searched = searched
  }
}

/** CLI가 성공했지만 stdout이 약속된 JSON 형태가 아닐 때 던져진다. */
export class SwiftOutputError extends Error {
  override readonly name = 'SwiftOutputError'
  /** 파싱에 실패한 원문. 길면 잘라서 담는다. */
  readonly raw: string

  constructor(message: string, raw: string, options?: { cause?: unknown }) {
    super(message, options)
    this.raw = raw
  }
}

/** 타임아웃으로 강제 종료된 경우. 번역처럼 오래 걸리는 작업과 진짜 행(hang)을 구분한다. */
export class SwiftTimeoutError extends Error {
  override readonly name = 'SwiftTimeoutError'
  readonly command: string
  readonly timeoutMs: number
  readonly stdout: string
  readonly stderr: string

  constructor(command: string, timeoutMs: number, stdout: string, stderr: string) {
    super(`${path.basename(command)} timed out after ${timeoutMs}ms`)
    this.command = command
    this.timeoutMs = timeoutMs
    this.stdout = stdout
    this.stderr = stderr
  }
}
