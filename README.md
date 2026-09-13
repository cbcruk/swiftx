# swiftx

macOS 프레임워크(Vision, PDFKit, Translation, …)를 감싼 Swift CLI들과, 그것을 Node에서
쓰기 위한 브리지를 한 곳에 모은 모노레포. 각 기능은 npm 패키지로 올라가고,
[pdf-translator](https://github.com/cbcruk/pdf-translator) 같은 소비 프로젝트가 설치해 바로 쓴다.

Swift 코드는 **독립 실행 파일**로 빌드되고, Node는 그것을 spawn해 **JSON으로만** 대화한다.
그렇게 정한 이유는 [설계 노트](docs/design.md#왜-in-process-애드온이-아니라-cli-스폰인가)에 있다.

## 패키지

호출 방법과 옵션은 패키지별 README에 있다.

| 패키지 | 하는 일 | macOS |
|---|---|---|
| [`@cbcruk/vision-ocr`](packages/vision-ocr/README.md) | 이미지에서 텍스트 인식 (Vision) | 13+ |
| [`@cbcruk/pdf-cli`](packages/pdf-cli/README.md) | PDF 텍스트 추출·구조 인식·리플로우 렌더 (PDFKit + Vision) | 26+ |
| [`@cbcruk/translate-cli`](packages/translate-cli/README.md) | 온디바이스 번역 (Translation) | 26+ |
| [`@cbcruk/swift-bridge`](packages/swift-bridge/README.md) | 위 셋이 공유하는 실행·JSON·오류 계층 | — |

## 설치

**macOS 전용**(래퍼는 `os: ["darwin"]`이라 다른 플랫폼에서는 설치가 거절된다), **Node 18 이상**.
바이너리를 실행하는 쪽이 macOS일 뿐이라 브리지 자체는 플랫폼을 가리지 않는다.

필요한 래퍼만 골라 설치한다. 미리 빌드된 유니버설 바이너리가 들어 있어
설치 시점에 Swift 툴체인이 필요 없다.

```sh
pnpm add @cbcruk/vision-ocr
```

브리지는 적지 않아도 된다 — 래퍼가 선언한 범위가 그대로 풀린다.
`SwiftCliError`로 오류를 가르는 소비자만 `"@cbcruk/swift-bridge": "^0.1.0"`을
`dependencies`에 함께 적는다. 릴리스에 tarball이 없는 이유는
[설계 노트](docs/design.md#왜-npm이-유일한-배포처인가)를 본다.

## 규약

모든 swiftx CLI가 지키는 계약. Swift 쪽은 `SwiftXKit`이, Node 쪽은 `@cbcruk/swift-bridge`가
같은 규약의 양쪽 끝을 구현한다.

| | 규약 |
|---|---|
| 성공 출력 | stdout에 한 줄짜리 JSON. 스트리밍이면 한 줄에 객체 하나(NDJSON) |
| 진단 출력 | stderr에 `<tool>: <원인>` 한 줄. 브리지가 [그 접두사가 붙은 줄](docs/design.md#왜-stderr의-첫-줄이-아니라-접두사-붙은-줄인가)을 골라 에러 메시지로 쓴다 |
| 종료 코드 | `0` 성공 · `1` 사용 오류 · `2` 입력 오류 · `3` 기능 사용 불가 · `4` 실행 실패 · `5`~ CLI 고유 |
| 입력 | 파일 경로는 인자로, 대량 텍스트는 stdin으로 |
| 응답 스키마 | 값이 없어도 [키가 존재한다](docs/design.md#왜-nullable-필드를-직접-인코딩하나) (`"title": null`) |

종료 코드가 부족하면 각 CLI가 `ExitCode`에 자기 코드를 덧붙이고, Node 쪽에서
`exitCodeMessages`로 사람이 읽을 메시지를 붙인다.

## 레이아웃

```
swift/
  core/                SwiftXKit — 종료 코드, JSON 출력, 인자 파서, 좌표/이미지 유틸 (macOS 13)
  pdf/                 pdf-cli — PDFKit 추출, Vision 구조 인식, 리플로우 렌더 (macOS 26)
  translate/           translate-cli — Apple on-device 번역 (macOS 26)
  vision/              vision-ocr-cli — Vision 텍스트 인식 (macOS 13)
packages/
  swift-bridge/        @cbcruk/swift-bridge — 실행, JSON 파싱, 바이너리 탐색
  pdf-cli/             @cbcruk/pdf-cli — 타입 붙은 pdf-cli 래퍼 + 동봉 바이너리
  translate-cli/       @cbcruk/translate-cli — 청크 분할·순서 보정을 포함한 번역 래퍼
  vision-ocr/          @cbcruk/vision-ocr — OCR 래퍼 + 사람용 vision-ocr 명령
scripts/
  build-universal.sh   arm64+x86_64 유니버설 바이너리를 만들어 npm 패키지에 동봉
  check-bundled-binary.mjs  바이너리 없이 배포되는 사고를 막는 prepack 검사
  release-notes.mjs    릴리스 본문(버전 표와 설치 명령)을 package.json에서 만들어 낸다
docs/
  design.md            지금 모양이 된 이유 (결정과 근거)
  mac-verification.md  맥에서만 확인할 수 있는 것들의 체크리스트와 검증 기록
```

### macOS 하한

Swift 패키지는 하나로 합치지 않고 하한별로 나눠 `SwiftXKit`을 path로 참조한다
([이유](docs/design.md#왜-swift-패키지를-하한별로-쪼갰나)).

| Swift 패키지 | 하한 | 이유 |
|---|---|---|
| `swift/core` (SwiftXKit) | macOS 13 | 공용 코드. 가장 낮은 소비자에 맞춘다 |
| `swift/pdf`, `swift/translate` | macOS 26 | `RecognizeDocumentsRequest`, `TranslationSession` |
| `swift/vision` | macOS 13 | `VNRecognizeTextRequest` |

## 개발

```sh
pnpm install
pnpm build                   # 래퍼 TypeScript 컴파일
pnpm typecheck
pnpm test                    # Swift CLI 계약을 흉내내는 대역으로 래퍼까지 검증한다

pnpm build:swift             # SwiftXKit 컴파일 확인 (macOS 필요)
swift test --package-path swift/vision           # 줄 병합 등 Swift 단위 테스트 (macOS 필요)
pnpm --filter @cbcruk/pdf-cli build:swift        # 유니버설 바이너리 → packages/pdf-cli/bin
```

개발 중에는 `.build/`의 산출물이 패키지 동봉본보다 [우선한다](docs/design.md#왜-build-산출물이-동봉-바이너리보다-우선하나).
특정 바이너리를 강제하려면 `SWIFTX_<NAME>_BIN`(예: `SWIFTX_PDF_CLI_BIN`)에 절대 경로를 준다.

### 배포

`Release` 워크플로(workflow_dispatch)에 태그를 주고 돌린다. macOS 러너에서 바이너리를
만들고, 브리지 → 래퍼 셋 순서로 npm에 올린다(`NPM_TOKEN` 시크릿). 래퍼마다 `prepack`이
동봉 바이너리 유무를 확인한다. 끝나면 그 태그로 GitHub 릴리스를 만들고, 본문의 버전 표와
설치 명령은 `scripts/release-notes.mjs`가 만든다.

레지스트리에 같은 버전이 이미 있는 패키지는 건너뛰므로, **패키지를 고쳤다면 그
`package.json`의 버전을 먼저 올려야** 실제로 배포된다.

## 문서

- [설계 노트](docs/design.md) — 왜 CLI 스폰인지, 왜 npm만 배포처인지 등 결정과 근거
- [맥에서 확인할 것](docs/mac-verification.md) — 툴체인 없는 환경에서 쌓인 미검증 항목과 검증 기록
