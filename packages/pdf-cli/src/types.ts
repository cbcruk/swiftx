/** `pdf-cli info`의 결과. 텍스트 레이어 유무로 추출 경로와 스캔 경로를 가른다. */
export interface PdfInfo {
  pageCount: number
  /** true면 PDFKit로 텍스트를 뽑고, false면 Vision 구조 인식(스캔 경로)으로 넘어간다. */
  hasTextLayer: boolean
}

/**
 * `pdf-cli extract`가 돌려주는 텍스트 한 줄과 그 기하 정보.
 * 좌표계는 PDF 관례를 따라 **좌하단 원점**이며, y는 위로 갈수록 커진다
 * (그래서 "윗줄"의 y가 "아랫줄"보다 크다).
 */
export interface ExtractedLine {
  text: string
  fontSize: number
  bold: boolean
  /** 줄 왼쪽 끝의 x. 정렬선/들여쓰기·표 감지의 기준이다. */
  x: number
  /** 줄 baseline 부근의 y (좌하단 원점). */
  y: number
  width: number
  height: number
}

/** 추출된 한 페이지. lines는 문서상의 읽기 순서로 담긴다. */
export interface ExtractedPage {
  /** 0-based 페이지 인덱스. */
  index: number
  width: number
  height: number
  lines: ExtractedLine[]
}

/** `pdf-cli extract`의 전체 결과. */
export interface ExtractResult {
  pageCount: number
  pages: ExtractedPage[]
}

/** Vision이 돌려주는 경계 상자. `ExtractedLine`과 같은 좌하단 원점 좌표계. */
export interface StructuredBox {
  x: number
  y: number
  width: number
  height: number
}

/** Vision `RecognizeDocumentsRequest`가 미리 그룹핑해준 문단. */
export interface StructuredParagraph {
  text: string
  box: StructuredBox
  /** 문단을 이루는 줄 수. 줄 높이(= box.height / lineCount) 추정에 쓰여 헤딩을 가른다. */
  lineCount: number
}

/** Vision이 인식한 표. rows[행][열] 순서의 셀 텍스트. */
export interface StructuredTable {
  box: StructuredBox
  rows: string[][]
}

/** Vision이 인식한 리스트와 그 항목들. */
export interface StructuredList {
  box: StructuredBox
  items: string[]
}

/** Vision 구조 인식이 돌려주는 한 페이지. */
export interface StructuredPage {
  index: number
  width: number
  height: number
  /** 페이지 제목으로 감지된 텍스트. 감지되지 않으면 `null`이며, 키는 항상 존재한다. */
  title: string | null
  paragraphs: StructuredParagraph[]
  tables: StructuredTable[]
  lists: StructuredList[]
}

/** `pdf-cli structure`의 전체 결과. */
export interface StructureResult {
  pageCount: number
  pages: StructuredPage[]
}

/** 리플로우 렌더러가 그릴 수 있는 블록 종류. */
export type RenderBlockType = 'heading' | 'body' | 'table'

/**
 * `pdf-cli render`에 넘기는 블록 하나. heading/body는 text만 쓰고,
 * table은 rows가 있으면 그리드로, 없으면 고정폭 텍스트로 강등해 그린다.
 */
export interface RenderBlock {
  type: RenderBlockType
  text: string
  /** 표 셀 텍스트 rows[행][열]. */
  rows?: string[][]
}

/** `pdf-cli render`의 결과: 실제로 쓰인 출력 경로와 만들어진 페이지 수. */
export interface RenderResult {
  output: string
  pageCount: number
}
