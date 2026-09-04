# vision-ocr-cli

Text recognition CLI built on Apple's Vision framework. Node consumers reach it through
[`@cbcruk/vision-ocr`](../../packages/vision-ocr); this file is the Swift-side design record.

## Usage

```sh
swift build

./.build/debug/vision-ocr-cli shot.png
./.build/debug/vision-ocr-cli --clipboard --languages ja-JP,en-US
cat shot.png | ./.build/debug/vision-ocr-cli --stdin
# → {"lines":["…"],"text":"…"}
```

Exit codes: `0` ok, `1` usage error, `2` cannot read or decode the image, `4` recognition
failure, `5` no image in the clipboard.

## Request configuration

Apple's [Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing-text-in-images)
documents how `VNRecognizeTextRequest` trades speed against accuracy. What this CLI picks, and why:

- **`.accurate` recognition level.** `.fast` is character-detection based; `.accurate` runs a
  neural network and holds up on dense or complex text. OCR here is a one-shot batch job, not an
  interactive loop, so accuracy wins.
- **`usesLanguageCorrection = true`.** Runs the result through a language model to fix likely
  misreads. It helps on natural language and hurts on non-dictionary strings — serial numbers,
  codes, licence keys. That trade is deliberate; the consumers are documents.
- **`recognitionLanguages` from `--languages`.** A priority-ordered BCP-47 list that picks both
  the models and the language-correction vocabulary. Default `["ko-KR", "en-US"]`. Query what an
  OS supports with `VNRecognizeTextRequest.supportedRecognitionLanguages(for:revision:)`.

Vision exposes further knobs this CLI does not use. They belong in
[`Sources/VisionOCRKit/Recognize.swift`](Sources/VisionOCRKit/Recognize.swift) if a consumer
ever needs them:

- `minimumTextHeight` — ignore text below a fraction of the image height. Raising it skips tiny
  text and speeds recognition up.
- `customWords` — supplement the language-correction vocabulary with domain terms.
- `automaticallyDetectsLanguage` — let Vision infer the language instead of pinning the list.
- `revision` — pin a recognizer revision so results stay reproducible across OS versions.

## Line merging

Vision returns **observations**, not lines: fragments with a `boundingBox` in normalized
coordinates with a **bottom-left origin**. Turning them into a reading-order transcript is our
job, and it is the only real logic in this package
([`LineMerging.swift`](Sources/VisionOCRKit/LineMerging.swift)).

- The y axis is flipped (`1 - box.midY`) so sorting runs top-to-bottom the way a page reads.
- Fragments join the current line when their y is within a tolerance of **the line's first
  fragment** — not the previous one. Comparing against the previous fragment lets the tolerance
  drift across a wide line and swallow the next one.
- The tolerance is **half the fragment's height** (floor `0.004` when height is 0), not a fixed
  constant. A fixed 0.02 merged tightly-set lines in dense documents and split nothing in sparse
  ones; scaling with glyph height tracks the actual line spacing.
- Sorting carries no tolerance of its own. Comparing "equal within ε" is not a strict weak
  ordering, and `sort` on such a comparator reorders elements unpredictably — that is what
  reversed lines in the output came from.

The model is deliberately simple: fragments at the same height on a **multi-column page get
stitched into one line**. Fixing that needs x-direction clustering to separate the columns, and
it is a separate piece of work. For document structure — titles, paragraphs, tables with cells —
use [`pdf-cli structure`](../pdf) instead, which asks Vision for `RecognizeDocumentsRequest`.

## Transparency

Images with an alpha channel are composited onto **white** before recognition. Vision reads
almost nothing off a transparent background, and PDF exports and screenshots hit this constantly.
If compositing fails, recognition falls back to the original image, so the change can never make
a result worse than the empty one it replaced.

The assumption this gets wrong is **white text on a transparent background**, which the white
ground erases. `flattenTransparency` takes a `background` argument for that case; the CLI does
not expose it as a flag.

## macOS floor

macOS 13, matching `VNRecognizeTextRequest`. That is the lowest floor in the repo, which is why
`SwiftXKit` sits in its own package ([`swift/core`](../core)) rather than being merged in —
SwiftPM applies `platforms:` per package, so a shared package would drag this one up to the
macOS 26 floor that `pdf-cli` and `translate-cli` need.
