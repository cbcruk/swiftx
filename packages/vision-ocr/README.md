# @cbcruk/vision-ocr

Extract text from images using the macOS **Vision** framework — offline, no API key, and no
Swift toolchain needed to install: the package ships a prebuilt binary.

Part of [swiftx](https://github.com/cbcruk/swiftx).

```bash
npm install @cbcruk/vision-ocr
```

Requires macOS 13+ and Node 18+.

## CLI

```bash
vision-ocr                      # OCR the clipboard image, copy the result back
vision-ocr screenshot.png       # OCR a file
vision-ocr shot.png --no-copy   # print only
vision-ocr --languages ja-JP,en-US
```

Exits `1` with a message when the clipboard holds no image or nothing was recognized. If copying
the result back fails, that is reported on stderr but does not change the exit code — the text is
already on stdout.

## API

```ts
import { recognize, recognizeText } from '@cbcruk/vision-ocr'

// async, full result
const { text, lines } = await recognize({ file: '/path/shot.png' })
await recognize({ clipboard: true })
await recognize({ buffer: pngBytes }, { languages: ['ko-KR', 'en-US'] })

// sync, text only
const text = recognizeText(pngBytes)
```

| Function | Returns |
| --- | --- |
| `recognize(source, options?)` | `Promise<{ lines, text }>` |
| `recognizeSync(source, options?)` | `{ lines, text }` |
| `recognizeText(buffer, options?)` | `string` |
| `recognizeTextFromFile(path, options?)` | `string` |
| `recognizeTextFromClipboard(options?)` | `string` |

`source` is exactly one of `{ file }`, `{ buffer }`, `{ clipboard: true }`.
`options`: `languages`, `binary`, `timeoutMs`, `signal`.

Recognizing nothing is **not** an error — you get an empty result. Text fragments are sorted
top-to-bottom, left-to-right and merged into lines, which is a deliberately simple model:
multi-column pages and tables will not survive it. For document structure (titles, paragraphs,
tables with cells), use [`@cbcruk/pdf-cli`](../pdf-cli)'s `readStructure`.

Failures throw `SwiftCliError` from `@cbcruk/swift-bridge` with the CLI's exit code: `1` usage,
`2` cannot read or decode the image, `4` recognition failure, `5` no image in the clipboard
(`VisionExitCode.clipboardEmpty`).

## Upgrading from 1.x

The three functions above keep their **1.x signatures** — synchronous, returning a string — so
existing call sites keep working. What changed:

- OCR now runs in a separate process instead of a `node-swift` native addon loaded into Node.
  There is **no `postinstall` build and no Swift toolchain requirement**; the package ships a
  universal binary.
- The package is **ESM only**. On CommonJS consumers older than Node 22.12, use a dynamic
  `import()`.
- Errors are `SwiftCliError` with an `exitCode`, not addon exceptions. Code that matched on the
  string `'No image found'` should check `error.exitCode === VisionExitCode.clipboardEmpty`.
- `recognize` (async) is the recommended entry point for servers; the synchronous functions block
  the event loop for the duration of the OCR.

MIT
