import {
  SwiftExitCode,
  runJson,
  runJsonSync,
  type CheckedRunOptions,
} from '@cbcruk/swift-bridge'
import { visionOcrBinary } from './binary.js'

export { VISION_OCR_BINARY, visionOcrBinary } from './binary.js'

/**
 * vision-ocr-cli의 종료 코드.
 *
 * `clipboardEmpty`를 따로 둔 것은 그것만이 사용자가 바로 고칠 수 있는 실패이기 때문이다
 * (이미지를 복사하고 다시 실행하면 된다).
 */
export const VisionExitCode = {
  ...SwiftExitCode,
  /** 클립보드에 이미지가 없다. */
  clipboardEmpty: 5,
} as const

/** 인식 결과. `text`는 `lines`를 개행으로 이은 것이다. */
export interface OCRResult {
  /** 위에서 아래로 병합된 줄들. */
  lines: string[]
  text: string
}

/** 이미지를 어디서 읽을지. 셋 중 하나만 지정한다. */
export type RecognizeSource =
  | { file: string }
  | { buffer: Uint8Array }
  | { clipboard: true }

export interface RecognizeOptions {
  /** 바이너리 경로를 직접 지정한다. 생략하면 `visionOcrBinary()`가 찾는다. */
  binary?: string
  /** 인식 언어 우선순위 (BCP-47). 기본값은 CLI 쪽 `['ko-KR', 'en-US']`. */
  languages?: readonly string[]
  timeoutMs?: number
  signal?: AbortSignal
}

/** 출처를 CLI 인자와 stdin으로 옮긴다. */
function invocation(
  source: RecognizeSource,
  options: RecognizeOptions
): { args: string[]; stdin?: Uint8Array } {
  const languageArgs =
    options.languages === undefined || options.languages.length === 0
      ? []
      : ['--languages', options.languages.join(',')]

  if ('file' in source) return { args: [source.file, ...languageArgs] }
  if ('clipboard' in source) return { args: ['--clipboard', ...languageArgs] }
  return { args: ['--stdin', ...languageArgs], stdin: source.buffer }
}

function runOptions(
  options: RecognizeOptions,
  stdin: Uint8Array | undefined
): CheckedRunOptions {
  return {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(stdin === undefined ? {} : { stdin }),
  }
}

/**
 * 이미지에서 텍스트를 인식한다.
 *
 * 인식된 글자가 없어도 실패가 아니다. 빈 `lines`와 빈 `text`를 돌려준다.
 *
 * @throws CLI가 실패하면 `SwiftCliError` (`exitCode`가
 *   `VisionExitCode.clipboardEmpty`면 클립보드가 비어 있다는 뜻)
 */
export function recognize(
  source: RecognizeSource,
  options: RecognizeOptions = {}
): Promise<OCRResult> {
  const { args, stdin } = invocation(source, options)
  return runJson<OCRResult>(visionOcrBinary(options.binary), args, runOptions(options, stdin))
}

/**
 * `recognize`의 동기 버전. 인식은 수백 ms가 걸리므로 이벤트 루프를 그만큼 막는다.
 * 서버에서는 `recognize`를 쓰고, 이것은 CLI나 스크립트처럼 동기 흐름이
 * 이미 계약인 자리에서만 쓴다.
 */
export function recognizeSync(
  source: RecognizeSource,
  options: RecognizeOptions = {}
): OCRResult {
  const { args, stdin } = invocation(source, options)
  return runJsonSync<OCRResult>(visionOcrBinary(options.binary), args, runOptions(options, stdin))
}

/**
 * 이미지 데이터(PNG, TIFF, JPEG 등)에서 텍스트를 뽑는다.
 * @returns 줄바꿈으로 이어진 인식 텍스트
 */
export function recognizeText(buffer: Uint8Array, options: RecognizeOptions = {}): string {
  return recognizeSync({ buffer }, options).text
}

/**
 * 이미지 파일에서 텍스트를 뽑는다.
 * @returns 줄바꿈으로 이어진 인식 텍스트
 */
export function recognizeTextFromFile(filePath: string, options: RecognizeOptions = {}): string {
  return recognizeSync({ file: filePath }, options).text
}

/**
 * 클립보드의 이미지에서 텍스트를 뽑는다.
 * @returns 줄바꿈으로 이어진 인식 텍스트
 * @throws 클립보드에 이미지가 없으면 `SwiftCliError`
 *   (`exitCode === VisionExitCode.clipboardEmpty`)
 */
export function recognizeTextFromClipboard(options: RecognizeOptions = {}): string {
  return recognizeSync({ clipboard: true }, options).text
}
