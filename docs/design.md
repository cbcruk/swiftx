# 설계 노트

swiftx가 지금 모양인 이유를 모아 둔다. **규칙은 [README](../README.md)에, 이유는 여기에** 적는다.
README나 코드 주석이 "왜"를 길게 설명하기 시작하면 그 문단은 이리로 옮기고 링크만 남긴다.
같은 근거가 여러 곳에 복제되면 하나를 고칠 때 나머지가 조용히 낡기 때문이다.

## 왜 in-process 애드온이 아니라 CLI 스폰인가

Swift 코드를 `node-swift` 같은 네이티브 애드온으로 묶지 않고, **독립 실행 파일로 빌드해
spawn하고 JSON으로만 대화한다.** 프로세스 경계를 두는 대가로 얻는 것:

- 소비 프로젝트가 설치 시점에 Swift 툴체인을 갖출 필요가 없다. 미리 빌드된 유니버설
  바이너리를 패키지에 동봉하므로 `npm install`이 컴파일을 돌리지 않는다.
- Node ABI/N-API 버전에 묶이지 않는다. Node를 올려도 다시 빌드할 필요가 없다.
- Vision/PDFKit이 죽어도 Node 프로세스는 살아남는다. 깨진 PDF 하나가 서버를 내리지 않는다.
- 실행 파일마다 macOS 하한을 따로 가질 수 있다 ([아래](#왜-swift-패키지를-하한별로-쪼갰나)).

대가인 프로세스 스폰 비용(~10–30ms)은 OCR·번역 자체의 비용에 묻힌다.

vision-ocr은 원래 `node-swift` 애드온이었고, 위 이유로 CLI 방식으로 갈아탔다.

## 왜 브리지만 npm에 올리나

바이너리를 동봉하는 래퍼 셋(`pdf-cli`, `translate-cli`, `vision-ocr`)은 GitHub 릴리스에
tarball로 붙고, `@cbcruk/swift-bridge`만 npm 레지스트리에 올라간다.

브리지는 이 저장소에서 **바이너리를 들고 다니지 않는 유일한 패키지**다 — 의존성 0,
플랫폼 잠금 없음. 그래서 레지스트리에 두는 비용이 사실상 없다.

올리지 않았을 때 실제로 깨졌던 것: 래퍼가 `@cbcruk/swift-bridge@^0.1.0`을 요구하는데
레지스트리에 그게 없으면 URL로 설치한 소비 측이 404로 죽는다. 소비 프로젝트가
`overrides`로 그 전이 의존성을 로컬 경로에 묶어 우회해야 했다. 브리지만 올려서
전이 해석을 정상으로 되돌렸다.

**브리지 tarball은 릴리스에 붙이지 않는다.** 붙어 있으면 소비 측이 그 URL을 걸 수 있고,
그러면 레지스트리 사본과 둘이 되어 `instanceof SwiftCliError`가 패키지 경계에서 깨진다.
사본이 하나로 모여야 오류 분기가 성립한다.

따라서 브리지를 고쳤다면 `packages/swift-bridge/package.json`의 버전을 **먼저 올려야**
한다. 릴리스 워크플로는 같은 버전이 레지스트리에 이미 있으면 발행을 건너뛴다.

전이 의존성은 최상위 `node_modules`에 노출되지 않으므로, `SwiftCliError`를 직접
import하는 소비자만 브리지를 `dependencies`에 함께 적는다. 사본은 여전히 하나다.

## 왜 Swift 패키지를 하한별로 쪼갰나

SwiftPM의 `platforms:`는 **패키지 단위**라, 하한이 섞이면 패키지 전체가 가장 높은 쪽으로
끌려 올라간다. `swift/`를 한 패키지로 합치면 macOS 13이면 충분한 vision-ocr까지
macOS 26을 요구하게 된다.

그래서 하한별로 패키지를 나누고, 공용 코드(`SwiftXKit`)는 가장 낮은 하한에 두어
path로 참조한다. 하한 표는 [README](../README.md#macos-하한)에 있다.

## 왜 stderr의 첫 줄이 아니라 접두사 붙은 줄인가

stderr는 우리 것만이 아니다. 깨진 PDF를 열면 CoreGraphics가
`CoreGraphics PDF has logged an error…`를 먼저 흘리고, 진짜 원인인
`pdf-cli: cannot open PDF: …`는 그 다음 줄에 온다. "첫 줄"을 원인으로 삼으면
프레임워크 잡음이 원인 자리를 차지한다.

그래서 CLI는 원인을 `<tool>: `로 시작하는 줄에 쓰기로 약속하고, 브리지는 **그 접두사가
붙은 줄**을 골라 쓴 뒤 없을 때만 첫 줄로 물러선다.

구현: `packages/swift-bridge/src/errors.ts`의 `failureLine()`, Swift 쪽은 `SwiftXKit`의 `fail`.

## 왜 nullable 필드를 직접 인코딩하나

Swift의 `Optional`은 기본 인코딩에서 값이 없으면 **키 자체를 생략한다.** 그러면 소비 측
타입이 `title?: string`과 `title: string | null` 사이에서 흔들린다.

응답 스키마의 필드는 값이 없어도 키가 존재하도록(`"title": null`) nullable 필드를 직접
인코딩한다. 스키마가 한 모양으로 고정되어야 브리지 쪽 타입이 거짓말을 하지 않는다.

## 왜 `.build` 산출물이 동봉 바이너리보다 우선하나

바이너리 탐색 순서는 `환경변수 → 개발 빌드(.build, 가장 최근 것) → 패키지 동봉본`이다.

개발 빌드를 동봉본보다 앞에 두지 않으면, 모노레포에서 방금 `swift build`한 결과가
배포본에 가려 수정→확인 루프가 돌지 않는다. 특정 바이너리를 강제해야 할 때만
`SWIFTX_<NAME>_BIN`으로 위 순서를 건너뛴다.

구현: `packages/swift-bridge/src/resolve-binary.ts`의 `resolveSwiftBinary()`.

## 이관 기록

`pdf-cli`와 `translate-cli`, 그리고 vision-ocr은 각자의 저장소에서 `git subtree`로
가져왔다. 커밋 히스토리를 보존하려고 그렇게 했으므로, 이 저장소의 초기 로그에는
모노레포가 생기기 전의 커밋이 섞여 있다. 옛 vision-ocr 저장소는 아카이브했고,
npm의 `@cbcruk/vision-ocr@1.0.3`은 폐기된 `node-swift` 애드온이다 — 이 패키지가 아니다.
