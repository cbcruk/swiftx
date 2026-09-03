import { SwiftOutputError } from './errors.js'
import { runChecked, runCheckedSync, type CheckedRunOptions } from './run-process.js'

/** 에러 메시지에 원문을 통째로 싣지 않기 위한 미리보기 길이. */
const PREVIEW_LIMIT = 400

function preview(text: string): string {
  const trimmed = text.trim()
  return trimmed.length <= PREVIEW_LIMIT ? trimmed : `${trimmed.slice(0, PREVIEW_LIMIT)}…`
}

/**
 * stdout 전체를 하나의 JSON 문서로 파싱한다. pdf-cli의 `info`/`extract`/`structure`처럼
 * 결과를 한 덩어리로 뱉는 명령의 출력 형식이다.
 *
 * @param source 에러 메시지에 쓸 출처 이름 (보통 바이너리 이름)
 * @throws 파싱 실패 시 `SwiftOutputError` (원문 앞부분을 함께 싣는다)
 */
export function parseJson<T>(text: string, source: string): T {
  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new SwiftOutputError(
      `${source} did not print valid JSON: ${preview(text)}`,
      text,
      { cause: error }
    )
  }
}

/**
 * 한 줄에 JSON 객체 하나씩(NDJSON) 찍는 출력을 배열로 파싱한다. translate-cli처럼
 * 결과를 스트리밍으로 뱉는 명령의 출력 형식이다. 빈 줄은 건너뛴다.
 *
 * @param source 에러 메시지에 쓸 출처 이름
 * @throws 어느 한 줄이라도 JSON이 아니면 줄 번호를 담아 `SwiftOutputError`
 */
export function parseJsonLines<T>(text: string, source: string): T[] {
  const parsed: T[] = []

  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return
    try {
      parsed.push(JSON.parse(line) as T)
    } catch (error) {
      throw new SwiftOutputError(
        `${source} printed a non-JSON line at line ${index + 1}: ${preview(line)}`,
        line,
        { cause: error }
      )
    }
  })

  return parsed
}

/** Swift CLI를 실행하고 stdout을 JSON 문서 하나로 파싱한다. */
export async function runJson<T>(
  command: string,
  args: readonly string[],
  options: CheckedRunOptions = {}
): Promise<T> {
  const result = await runChecked(command, args, options)
  return parseJson<T>(result.stdout, command)
}

/** Swift CLI를 실행하고 stdout을 NDJSON으로 파싱한다. */
export async function runJsonLines<T>(
  command: string,
  args: readonly string[],
  options: CheckedRunOptions = {}
): Promise<T[]> {
  const result = await runChecked(command, args, options)
  return parseJsonLines<T>(result.stdout, command)
}

/** `runJson`의 동기 버전. */
export function runJsonSync<T>(
  command: string,
  args: readonly string[],
  options: CheckedRunOptions = {}
): T {
  const result = runCheckedSync(command, args, options)
  return parseJson<T>(result.stdout, command)
}
