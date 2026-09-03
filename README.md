# swiftx

macOS 프레임워크(Vision, PDFKit, Translation, …)를 감싼 Swift CLI들과, 그것을 Node에서
쓰기 위한 브릿지를 한 곳에 모은 모노레포. 각 기능은 npm 패키지로 배포되어
[vision-ocr](https://github.com/cbcruk/vision-ocr), [pdf-translator](https://github.com/cbcruk/pdf-translator)
같은 소비 프로젝트에서 `install` 후 바로 쓰인다.

## 연결 방식

Swift 코드는 **독립 실행 파일**로 빌드되고, Node는 그것을 spawn해서 **JSON으로만** 대화한다.
in-process 네이티브 애드온(node-swift)을 쓰지 않는 이유:

- 소비 프로젝트가 설치 시점에 Swift 툴체인을 갖출 필요가 없다 (미리 빌드된 바이너리를 동봉한다).
- Node ABI/N-API 버전에 묶이지 않는다.
- Vision/PDFKit이 죽어도 Node 프로세스는 살아남는다.
- 실행 파일마다 macOS 하한을 따로 가질 수 있다 (아래 표).

프로세스 스폰 비용(~10–30ms)은 OCR·번역 자체의 비용에 묻힌다.

## 규약

모든 swiftx CLI가 지키는 계약. Swift 쪽은 `SwiftXKit`이, Node 쪽은 `@cbcruk/swift-bridge`가
같은 규약의 양쪽 끝을 구현한다.

| | 규약 |
|---|---|
| 성공 출력 | stdout에 한 줄짜리 JSON. 스트리밍이면 한 줄에 객체 하나(NDJSON) |
| 진단 출력 | stderr **첫 줄**에 실패 원인 한 줄 (브릿지가 에러 메시지로 그대로 쓴다) |
| 종료 코드 | `0` 성공 · `1` 사용 오류 · `2` 입력 오류 · `3` 기능 사용 불가 · `4` 실행 실패 |
| 입력 | 파일 경로는 인자로, 대량 텍스트는 stdin으로 |

종료 코드가 부족하면 각 CLI가 `ExitCode`에 자기 코드를 덧붙이고, Node 쪽에서
`exitCodeMessages`로 사람이 읽을 메시지를 붙인다.

## 레이아웃

```
swift/
  core/                SwiftXKit — 종료 코드, JSON 출력, 인자 파서, 좌표/이미지 유틸 (macOS 13)
packages/
  swift-bridge/        @cbcruk/swift-bridge — 실행, JSON 파싱, 바이너리 탐색
scripts/
  build-universal.sh   arm64+x86_64 유니버설 바이너리를 만들어 npm 패키지에 동봉
```

### macOS 하한

SwiftPM의 `platforms:`는 패키지 단위라 하한이 섞이면 전체가 위로 끌려간다.
그래서 Swift 패키지를 하나로 합치지 않고, 하한별로 나눠 `SwiftXKit`을 path로 참조한다.

| Swift 패키지 | 하한 | 이유 |
|---|---|---|
| `swift/core` (SwiftXKit) | macOS 13 | 공용 코드. 가장 낮은 소비자에 맞춘다 |
| `swift/vision` *(예정)* | macOS 13 | `VNRecognizeTextRequest` |
| `swift/pdf`, `swift/translate` *(예정)* | macOS 26 | `RecognizeDocumentsRequest`, `TranslationSession` |

## 개발

```sh
pnpm install
pnpm typecheck
pnpm test

pnpm build:swift                                   # SwiftXKit (macOS 필요)
scripts/build-universal.sh swift/pdf pdf-cli packages/pdf-cli/bin
```

개발 중에는 `.build/`의 산출물이 패키지 동봉본보다 우선한다. 특정 바이너리를 강제하려면
`SWIFTX_<NAME>_BIN`(예: `SWIFTX_PDF_CLI_BIN`)에 절대 경로를 준다.

## 진행 상황

- [x] **1단계** — 모노레포 스캐폴딩, `SwiftXKit`, `@cbcruk/swift-bridge`
- [ ] **2단계** — `pdf-cli` · `translate-cli`를 pdf-translator에서 이관, 프리빌트 배포 파이프라인 검증
- [ ] **3단계** — vision-ocr을 CLI 방식으로 전환해 이관 (node-swift 경로 폐기)

이관은 `git subtree`로 커밋 히스토리를 보존해 가져온다.
