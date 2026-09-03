# @cbcruk/pdf-cli

PDFKit text extraction and Vision document-structure recognition, exposed to Node as a
**prebuilt macOS binary** — no Swift toolchain needed to install.

Part of [swiftx](https://github.com/cbcruk/swiftx).

```bash
npm install @cbcruk/pdf-cli
```

Requires **macOS 26+** (`RecognizeDocumentsRequest`) and Node 18+.

## Usage

```ts
import { readPdfInfo, extractPdf, readStructure, renderPdf } from '@cbcruk/pdf-cli'

// Which path should this document take?
const info = await readPdfInfo('paper.pdf')      // { pageCount, hasTextLayer }

if (info.hasTextLayer) {
  // PDFKit: lines with bbox, font size and bold flag, in reading order
  const { pages } = await extractPdf('paper.pdf')
} else {
  // Vision: titles, paragraphs, tables with cells, lists — rasterized, so much slower
  const { pages } = await readStructure('scan.pdf', {
    languages: ['ko-KR', 'en-US'],
    pages: [0, 1],   // 0-based; omit for the whole document
    scale: 3,
  })
}

// Reflow blocks into a fresh PDF (Core Text layout, table grids, pagination)
const { output, pageCount } = await renderPdf(
  [
    { type: 'heading', text: '제목' },
    { type: 'body', text: '본문…' },
    { type: 'table', text: '', rows: [['A', 'B'], ['1', '2']] },
  ],
  'out.pdf'
)
```

Coordinates follow the PDF convention: **bottom-left origin**, y grows upward.

Every field in the schema is always present: a page with no detected title has
`title: null`, not a missing key.

Every function accepts `binary`, `timeoutMs` and `signal`.

## Errors

Failures throw `SwiftCliError` from `@cbcruk/swift-bridge`, carrying the CLI's exit code:

| Code | Meaning |
| --- | --- |
| `1` | usage error |
| `2` | cannot open or parse the input PDF |
| `4` | execution failure (recognition, rendering, fonts) |

## Binary resolution

`SWIFTX_PDF_CLI_BIN` → a local `swift build` inside the swiftx monorepo → the binary bundled in
this package. The same executable is also exposed as a `pdf-cli` bin, so `npx pdf-cli --help`
works.

MIT
