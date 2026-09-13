# @cbcruk/translate-cli

Apple's **on-device** translation (the `Translation` framework) exposed to Node as a prebuilt
macOS binary — no API key, no network, no Swift toolchain needed to install.

Part of [swiftx](https://github.com/cbcruk/swiftx).

```bash
npm install @cbcruk/translate-cli
```

Requires **macOS 26+**, Node 18+, and the language pair installed on the machine
(System Settings → General → Language & Region → Translation Languages).

## Usage

```ts
import { checkAvailability, translate, TranslateExitCode } from '@cbcruk/translate-cli'

const { status } = await checkAvailability({ source: 'en', target: 'ko' })
// 'installed' | 'supported' | 'unsupported' | 'unknown'

const translated = await translate(['Hello', 'World'], {
  source: 'en',
  target: 'ko',
  chunkSize: 12,
  onProgress: (done, total) => process.stderr.write(`${done}/${total}\r`),
})
// same length and order as the input
```

`translate` splits the input into chunks and runs them **sequentially** — on-device translation
is serialized at the system daemon, so parallel calls buy nothing. It reorders each chunk by the
CLI's `index` and throws if a chunk comes back short, so a silent drop can't reach your output.

For a single call without chunking, use `translateOnce`, which returns the raw
`{ index, sourceText, targetText }` lines.

## Errors

Failures throw `SwiftCliError` from `@cbcruk/swift-bridge`, carrying the CLI's exit code:

| `TranslateExitCode` | Code | Meaning |
| --- | --- | --- |
| `usage` | `1` | usage or stdin error |
| `unavailable` | `3` | the language pair is not supported at all |
| `failure` | `4` | translation failed |
| `languagePackMissing` | `5` | supported, but the pack is not downloaded yet |

`5` is worth handling on its own: it is the one failure the user can fix, and the CLI's stderr
already carries the instructions.

## Binary resolution

`SWIFTX_TRANSLATE_CLI_BIN` → a local `swift build` inside the swiftx monorepo → the binary
bundled in this package. Also exposed as a `translate-cli` bin.

MIT
