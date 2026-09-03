import { SwiftExitCode, runJson, runJsonLines, type CheckedRunOptions } from '@cbcruk/swift-bridge'
import { translateCliBinary } from './binary.js'

export { TRANSLATE_CLI_BINARY, translateCliBinary } from './binary.js'

/**
 * translate-cli의 종료 코드. 공통 규약에 이 CLI만의 코드를 더한 것이다.
 *
 * `languagePackMissing`과 `unavailable`을 나누는 이유는, 전자는 사용자가 언어팩을
 * 내려받으면 해결되고 후자는 그렇지 않기 때문이다. 호출부의 안내 문구가 달라진다.
 */
export const TranslateExitCode = {
  ...SwiftExitCode,
  /** 언어 쌍은 지원되지만 언어팩이 설치되어 있지 않다. */
  languagePackMissing: 5,
} as const

/** 언어 쌍의 설치/지원 상태. */
export type LanguageAvailabilityStatus = 'installed' | 'supported' | 'unsupported' | 'unknown'

/** `translate-cli --check`의 결과. */
export interface AvailabilityResult {
  status: LanguageAvailabilityStatus
  source: string
  target: string
}

/** translate-cli가 NDJSON 한 줄로 돌려주는 번역 결과. */
export interface TranslatedLine {
  index: number
  sourceText: string
  targetText: string
}

/** 모든 translate-cli 호출이 공유하는 옵션. */
export interface TranslateCliOptions {
  binary?: string
  /** 원문 언어. 기본 `en`. */
  source?: string
  /** 번역 언어. 기본 `ko`. */
  target?: string
  timeoutMs?: number
  signal?: AbortSignal
}

/** `translate`에 추가로 주는 옵션. */
export interface TranslateOptions extends TranslateCliOptions {
  /**
   * 한 번의 프로세스 호출에 넘길 문장 수. 기본 12.
   *
   * on-device 번역은 시스템 데몬 수준에서 직렬화되어 병렬 호출 이득이 없으므로
   * 청크는 순차로 처리한다. 청크를 키우면 호출 횟수가 줄지만 진행률이 거칠어진다.
   */
  chunkSize?: number
  /** 진행 콜백. (완료 문장 수, 전체 문장 수). */
  onProgress?: (completed: number, total: number) => void
}

const DEFAULT_SOURCE = 'en'
const DEFAULT_TARGET = 'ko'
const DEFAULT_CHUNK_SIZE = 12

function languageArgs(options: TranslateCliOptions): string[] {
  return [
    '--source',
    options.source ?? DEFAULT_SOURCE,
    '--target',
    options.target ?? DEFAULT_TARGET,
  ]
}

function runOptions(options: TranslateCliOptions, stdin?: string): CheckedRunOptions {
  return {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(stdin === undefined ? {} : { stdin }),
  }
}

/**
 * 언어 쌍을 이 기기에서 쓸 수 있는지 확인한다. 번역을 시작하기 전에 호출해
 * 언어팩 안내를 먼저 띄우는 용도다.
 */
export function checkAvailability(
  options: TranslateCliOptions = {}
): Promise<AvailabilityResult> {
  return runJson<AvailabilityResult>(
    translateCliBinary(options.binary),
    [...languageArgs(options), '--check'],
    runOptions(options)
  )
}

/**
 * 문장 배열을 한 번의 프로세스 호출로 번역한다. 결과는 CLI가 준 순서 그대로다.
 * 긴 입력은 `translate`를 쓴다.
 */
export function translateOnce(
  texts: readonly string[],
  options: TranslateCliOptions = {}
): Promise<TranslatedLine[]> {
  return runJsonLines<TranslatedLine>(
    translateCliBinary(options.binary),
    languageArgs(options),
    runOptions(options, JSON.stringify(texts))
  )
}

/**
 * 문장 배열을 청크로 나눠 순차 번역하고, **입력과 같은 순서·길이**의 번역문을 돌려준다.
 *
 * @throws 어느 청크든 입력 개수와 결과 개수가 다르면 (조용한 누락을 막는다)
 * @throws CLI가 실패하면 `SwiftCliError` (`exitCode`로 원인을 가른다.
 *   `TranslateExitCode.languagePackMissing`이면 언어팩 설치 안내를 띄우면 된다)
 */
export async function translate(
  texts: readonly string[],
  options: TranslateOptions = {}
): Promise<string[]> {
  if (texts.length === 0) return []

  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  if (chunkSize < 1) {
    throw new RangeError(`chunkSize must be at least 1, got ${chunkSize}`)
  }

  // 바이너리 탐색은 한 번만 하고 모든 청크가 같은 경로를 쓴다.
  const binary = translateCliBinary(options.binary)
  const translated: string[] = []

  for (let offset = 0; offset < texts.length; offset += chunkSize) {
    const chunk = texts.slice(offset, offset + chunkSize)
    const lines = await translateOnce(chunk, { ...options, binary })

    if (lines.length !== chunk.length) {
      throw new Error(
        `translate-cli returned ${lines.length} results for ${chunk.length} inputs`
      )
    }

    // CLI는 입력 순서로 뱉지만, 계약은 index다. index를 신뢰해 정렬한다.
    const ordered = [...lines].sort((a, b) => a.index - b.index)
    translated.push(...ordered.map((line) => line.targetText))
    options.onProgress?.(translated.length, texts.length)
  }

  return translated
}
