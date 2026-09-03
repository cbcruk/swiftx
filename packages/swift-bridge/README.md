# @cbcruk/swift-bridge

The Node side of the [swiftx](https://github.com/cbcruk/swiftx) contract: run a macOS Swift
CLI, read JSON back, and turn a non-zero exit code into a typed error.

It is a thin wiring layer with **no dependencies**, and it is not macOS-only itself — only the
binaries it launches are.

```bash
npm install @cbcruk/swift-bridge
```

## Usage

```ts
import {
  bundledBinaryDir,
  resolveSwiftBinary,
  runJson,
  runJsonLines,
  SwiftCliError,
} from '@cbcruk/swift-bridge'

const binary = resolveSwiftBinary('pdf-cli', {
  bundledDirs: [bundledBinaryDir(import.meta.url)],
})

// stdout is one JSON document
const info = await runJson<{ pageCount: number }>(binary, ['info', 'paper.pdf'])

// stdout is one JSON object per line
const lines = await runJsonLines(binary, ['--target', 'ko'], {
  stdin: JSON.stringify(['Hello', 'World']),
  exitCodeMessages: { 2: 'Translation language pack is not installed.' },
})
```

Failures arrive as typed errors, with the CLI's own exit code preserved so callers can branch
on it:

```ts
try {
  await runJson(binary, ['structure', 'scan.pdf'])
} catch (error) {
  if (error instanceof SwiftCliError && error.exitCode === 2) {
    // input error — the CLI could not open the file
  }
}
```

## Binary resolution

`resolveSwiftBinary(name, options)` looks in this order:

1. `SWIFTX_<NAME>_BIN` — an explicit override (`pdf-cli` → `SWIFTX_PDF_CLI_BIN`). If it is set
   but not executable, resolution fails instead of silently falling through.
2. `devPackageRoots` — SwiftPM output under `<root>/.build/{release,debug}/<name>` and
   `<root>/.build/<triple>/{release,debug}/<name>`; the most recently built one wins, so a local
   `swift build` shadows the shipped binary.
3. `bundledDirs` — binaries shipped inside the npm package, e.g. `bundledBinaryDir(import.meta.url)`
   for `<package>/bin`.

When nothing matches, `SwiftBinaryNotFoundError` lists every path it searched.

## API

| Export | Purpose |
| --- | --- |
| `runProcess` / `runProcessSync` | Spawn and collect stdout, stderr, exit code |
| `runChecked` / `runCheckedSync` | …and throw `SwiftCliError` on a non-zero exit |
| `runJson` / `runJsonSync` | …and parse stdout as one JSON document |
| `runJsonLines` | …and parse stdout as NDJSON |
| `parseJson` / `parseJsonLines` | Parse output you already have |
| `ensureSuccess` | Apply the exit-code check to a result yourself |
| `resolveSwiftBinary` / `bundledBinaryDir` / `swiftBinaryEnvVar` | Locate the binary |

`RunOptions`: `stdin`, `cwd`, `env`, `timeoutMs`, `maxBuffer`, `signal`.
`CheckedRunOptions` adds `exitCodeMessages` for per-exit-code messages.

Errors: `SwiftCliError` (non-zero exit; carries `exitCode`, `stdout`, `stderr`),
`SwiftBinaryNotFoundError` (carries `searched`), `SwiftOutputError` (stdout was not the promised
JSON; carries `raw`), `SwiftTimeoutError` (killed by `timeoutMs`).

## Notes

ESM only. On CommonJS consumers older than Node 22.12, load it with a dynamic `import()`.

MIT
