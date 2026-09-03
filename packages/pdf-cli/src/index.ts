import { runJson, type CheckedRunOptions } from '@cbcruk/swift-bridge'
import { pdfCliBinary } from './binary.js'
import type {
  ExtractResult,
  PdfInfo,
  RenderBlock,
  RenderResult,
  StructureResult,
} from './types.js'

export { PDF_CLI_BINARY, pdfCliBinary } from './binary.js'
export type * from './types.js'

/** 모든 pdf-cli 호출이 공유하는 옵션. */
export interface PdfCliOptions {
  /** 바이너리 경로를 직접 지정한다. 생략하면 `pdfCliBinary()`가 찾는다. */
  binary?: string
  /** 이 시간을 넘기면 프로세스를 종료시키고 `SwiftTimeoutError`를 던진다. */
  timeoutMs?: number
  signal?: AbortSignal
}

/** `structure` 전용 옵션. */
export interface StructureOptions extends PdfCliOptions {
  /** 인식 언어 우선순위. 기본값은 CLI 쪽 `['ko-KR', 'en-US']`. */
  languages?: readonly string[]
  /** 지정한 페이지(0-based)만 인식한다. 표가 있는 페이지만 돌리는 식으로 쓴다. */
  pages?: readonly number[]
  /** 페이지를 래스터화할 배율. 기본값은 CLI 쪽 `3`. */
  scale?: number
}

function runOptions(options: PdfCliOptions, stdin?: string): CheckedRunOptions {
  return {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(stdin === undefined ? {} : { stdin }),
  }
}

/** 페이지 수와 텍스트 레이어 유무를 조회한다 (추출/스캔 경로 분기의 근거). */
export function readPdfInfo(inputPath: string, options: PdfCliOptions = {}): Promise<PdfInfo> {
  return runJson<PdfInfo>(pdfCliBinary(options.binary), ['info', inputPath], runOptions(options))
}

/** PDFKit로 페이지별 줄 텍스트와 bbox·폰트 정보를 뽑는다 (텍스트 레이어 경로). */
export function extractPdf(
  inputPath: string,
  options: PdfCliOptions = {}
): Promise<ExtractResult> {
  return runJson<ExtractResult>(
    pdfCliBinary(options.binary),
    ['extract', inputPath],
    runOptions(options)
  )
}

/**
 * Vision `RecognizeDocumentsRequest`로 문단/제목/표/리스트 구조를 인식한다.
 * 페이지를 래스터화해 돌리므로 `extract`보다 훨씬 느리다. 스캔 문서 전체,
 * 또는 텍스트 문서에서 표가 있는 페이지에만 골라 쓰는 것을 전제로 한다.
 */
export function readStructure(
  inputPath: string,
  options: StructureOptions = {}
): Promise<StructureResult> {
  const args = ['structure', inputPath]
  if (options.languages !== undefined && options.languages.length > 0) {
    args.push('--languages', options.languages.join(','))
  }
  if (options.pages !== undefined && options.pages.length > 0) {
    args.push('--pages', options.pages.join(','))
  }
  if (options.scale !== undefined) {
    args.push('--scale', String(options.scale))
  }

  return runJson<StructureResult>(pdfCliBinary(options.binary), args, runOptions(options))
}

/**
 * 블록 배열을 새 PDF로 조판한다. 원본 레이아웃을 재현하지 않고 읽기 순서대로
 * 다시 흘려보내며, 블록 단위 레이아웃·표 그리드·페이지네이션은 렌더러가 처리한다.
 *
 * @param blocks 읽기 순서의 블록들 (비어 있으면 CLI가 사용 오류로 거절한다)
 * @param outputPath 결과 PDF를 쓸 경로
 */
export function renderPdf(
  blocks: readonly RenderBlock[],
  outputPath: string,
  options: PdfCliOptions = {}
): Promise<RenderResult> {
  return runJson<RenderResult>(
    pdfCliBinary(options.binary),
    ['render', '--output', outputPath],
    runOptions(options, JSON.stringify({ blocks }))
  )
}
