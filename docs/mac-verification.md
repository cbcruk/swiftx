# 맥에서 확인할 것

이 리포의 Swift 코드는 Swift 툴체인이 없는 환경에서 작성된다. TypeScript 쪽은 CLI 계약을
흉내내는 대역으로 검증되지만, **Swift는 컴파일조차 확인되지 않은 채 커밋된다.** 실제로
`package: "swiftx-core"`(디렉터리 이름인 `core`여야 한다) 같은 빌드 차단 버그가 맥에서야
드러났고, `pnpm test`로는 잡히지 않았다.

이 문서는 그 간극을 메우는 체크리스트이자, 마지막 검증의 기록이다.

**마지막 검증: 2026-09-03 · macOS 26.5.1 (arm64) · Swift 6.3.3 · Node 24.20 · pnpm 10.33**
이때 1~3절이 전부 통과했다. Swift를 건드린 뒤에는 다시 돌린다.

## 0. 시작 전

```sh
git status
git pull
pnpm install
```

## 1. 기본 통과 기준

```sh
pnpm typecheck                 # 클린
pnpm test                      # 80개 통과 (bridge 40 · pdf-cli 8 · translate-cli 11 · vision-ocr 21)

swift build -c release --package-path swift/core
swift build -c release --package-path swift/pdf
swift build -c release --package-path swift/translate
swift build -c release --package-path swift/vision
swift test  --package-path swift/vision        # LineMergingTests 8개
```

`typecheck`가 `build`를 먼저 도는 이유: 패키지끼리 `dist/`의 `.d.ts`로 물려 있어서,
갓 체크아웃한 트리에서 바로 `tsc --noEmit`을 돌리면 `@cbcruk/swift-bridge`를 못 찾고
TS2307로 죽는다. `pnpm test`는 swift-bridge의 test 스크립트가 `pnpm build`를 먼저
부르는 덕에 우연히 통과했다 — CI의 node 잡이 `install → typecheck` 순서라 여기서 걸렸다.

CI(`.github/workflows/ci.yml`)가 push마다 같은 것을 돈다 — ubuntu에서 Node,
macos-26에서 Swift. 로컬에서 놓쳐도 여기서 한 번 더 걸린다.

## 2. 수정 A–D (확인 완료)

맥 검증에서 나온 발견 네 건. 고친 결과를 실제 맥에서 확인했다.

### A. stderr에서 CLI 자신의 줄 고르기

CoreGraphics가 같은 stderr에 자기 진단을 먼저 흘려서 진짜 원인이 묻혔다. 이제 브릿지가
`<tool>: ` 접두사가 붙은 줄을 골라 쓴다.

```sh
head -c 6000 sample.pdf > truncated.pdf
```

CLI stderr에는 여전히 `CoreGraphics PDF has logged an error…`가 먼저 나오지만,
`readPdfInfo('truncated.pdf')`가 던지는 메시지는
`pdf-cli exited with code 2: cannot open PDF: …`다. 원문은 `error.stderr`에 남는다.

같은 필터가 PDFKit이 `extract` 중에 흘리는 `attributedStringScaled …`도 걸러낸다.

### B. 줄 병합 허용 오차

고정값 0.02 → **조각 높이의 0.5배**(높이 0이면 하한 0.004). 정렬에서 허용 오차를 걷어내
strict weak ordering을 회복했고, 줄 판정 기준을 직전 조각에서 현재 줄의 첫 조각으로 바꿨다.

5줄 문서가 5줄로 나오고 순서가 보존된다. 행간을 44px → 32px로 좁힌 픽스처에서도
합쳐지지 않는다 (예전엔 3줄로 합쳐지고 1·2번이 뒤집혔다).

### C. `title` 키 존재

Swift `Optional`은 nil이면 키 자체를 생략한다. 이제 명시적으로 `null`을 내보낸다.

```sh
pdf-cli structure sample.pdf | jq '.pages[] | has("title")'
```

제목이 검출된 페이지와 `title: null`인 페이지(표만 있는 문서) 양쪽 다 `true`.

### D. 투명 배경 합성

알파 채널이 있으면 흰 배경 위로 합성한 뒤 인식한다. 알파 있는 검은 글자 PNG에서
5줄 모두 인식된다. (합성 실패 시 원본으로 인식을 시도하므로, 어떤 경우에도
exit 0 + 빈 결과보다 나빠지지는 않는다.)

## 3. 실제 기능 검증 (확인 완료)

### 번역

언어팩(English + 한국어)을 받은 뒤 확인했다.

```sh
translate-cli --source en --target ko --check     # {"status":"installed",...}
echo '["Hello, world."]' | translate-cli --source en --target ko
```

래퍼도 실제 번역으로 돌렸다 — `chunkSize: 3` / 7문장에서 `onProgress`가
3/7 → 6/7 → 7/7로 누적되고, 개수와 입력 순서가 보존된다.

미지원 언어 쌍은 두 경로가 갈린다: `--check`는 exit 0 + `status: "unsupported"`,
실제 번역은 exit 3. 안내 문구를 띄우는 쪽은 `--check`를 쓴다.

### 스캔 PDF

이미지만 있는 한글 PDF에서 `hasTextLayer: false` 분기와 OCR 경로가 동작한다
(`--languages ko-KR,en-US`로 제목 1 + 문단 4를 정확히 뽑았다).

### 표

7행짜리 표는 Vision이 표로 잡는다 (4×7 셀 전부). 4행짜리 작은 표가 문단으로 흐르던
것과 대비된다 — 판정 하한은 Vision 쪽에 있다.

**표 셀이 `paragraphs`에도 중복으로 들어온다.** Vision의 `container.paragraphs`가
표 안 텍스트를 포함하고, CLI는 그대로 통과시킨다 (7×4 표 → 문단 28개). 표 끝에
빈 행 하나가 붙는 것도 같은 성격이다. 소비 측에서 `tables`의 박스와 겹치는 문단을
걸러야 같은 내용을 두 번 번역·렌더하지 않는다.

## 4. 알려진 한계 (버그 아님)

- **다단 레이아웃** — 단을 가로질러 같은 높이에 있는 조각이 한 줄로 붙는다 (2단 픽스처로
  재현 확인). B 수정으로도 해결되지 않는다. 제대로 하려면 x 방향 군집(단 분리)이
  필요하고, 별도 작업이다. 구조가 필요하면 `pdf-cli structure` 쪽을 쓴다.
- **흰 글자 / 투명 배경** — D의 흰 배경 합성이 글자를 지운다. `flattenTransparency`의
  `background` 인자로 열려 있지만 CLI 플래그로는 노출하지 않았다.
- **작은 표** — Vision의 판정 기준이라 우리 쪽에서 고칠 수 없다. pdf-translator에
  "표 매칭 실패 시 고정폭 텍스트로 강등"하는 폴백이 있으니 그 경로가 실제로 도는지
  확인할 가치가 있다.

## 5. 다음 작업 순서

1. **pdf-translator 전환** — `file:` 링크로 `@cbcruk/pdf-cli`·`@cbcruk/translate-cli`를
   물려 실제 PDF로 파이프라인을 통과시킨다. 배포 전에 하는 게 되돌리기 가장 쉽다.
   `src/utils/{run-process,swift-binaries}.ts`와 `src/pipeline/ingest.types.ts`가 지워진다.
   이때 3절의 표/문단 중복 필터도 같이 넣는다.
2. **npm 배포** — 아래 체크리스트.
3. **vision-ocr 리포 정리** — README를 swiftx로 넘기고 아카이브. 2.0.0의 마이그레이션
   노트는 `packages/vision-ocr/README.md`에 있다.

## 6. 릴리스 체크리스트 (경로 확인 완료)

```sh
pnpm --filter @cbcruk/pdf-cli build:swift      # lipo → ad-hoc codesign → packages/pdf-cli/bin
pnpm --filter @cbcruk/pdf-cli pack             # prepack 가드가 바이너리 유무를 확인한다
```

pdf-cli · translate-cli · vision-ocr 셋 다 `x86_64 arm64` 유니버설로 나오고 ad-hoc
서명 검증을 통과한다. macOS 26을 대상으로 한 x86_64 크로스 컴파일도 문제없었다
(macos-26 러너는 arm64 전용이라 여기가 첫 릴리스의 위험 지점이었다).
`ARCHS=arm64`로 슬라이스를 줄일 수 있다.

tarball을 임시 디렉터리에 설치해 소비자 입장에서도 확인했다 — 동봉 바이너리 탐색,
`vision-ocr` 실행 파일, 파일·버퍼·클립보드 세 입력 경로가 모두 동작한다.

`github:cbcruk/swiftx#path:/packages/vision-ocr` 형태의 git 의존성은 쓰지 않는다.
pnpm이 문법은 받아주지만 `bin/`과 `dist/`가 gitignore라 tarball에 없고, 채우려면
소비 측에 Swift 툴체인을 요구하게 된다 — node-swift를 버린 이유가 다시 돌아온다.

- 배포는 `Release` 워크플로(workflow_dispatch)에 태그를 주고 돌린다. 네 패키지를 한꺼번에
  pack해서 그 태그의 GitHub 릴리스에 붙인다. npm에 올리지 않으므로 토큰 시크릿은 필요 없고,
  워크플로의 `contents: write` 권한으로 충분하다.
- 첫 릴리스(`2026.09.03`)를 실제로 돌려 소비 측 설치까지 확인했다. 릴리스 URL로
  네 패키지를 설치하고 OCR·PDF·번역이 모두 동작한다. `@cbcruk/swift-bridge`를
  `overrides`로 고정해야 하고(없으면 `ERR_PNPM_FETCH_404` — 레지스트리에 없는 이름),
  그러면 브릿지 사본이 하나로 모여 다른 패키지가 던진 오류에도
  `instanceof SwiftCliError`가 성립한다.
- `SwiftCliError`를 직접 import하려면 override와 별개로 `dependencies`에도 브릿지를
  넣어야 한다. override는 해석만 바꿀 뿐 최상위 `node_modules`에 노출하지 않는다.
- `@cbcruk/vision-ocr`은 **2.0.0**이다. 1.x는 node-swift 애드온이라 실행 모델이 다르다.

## 픽스처 만들기

리포에 바이너리 픽스처를 두지 않으므로 검증할 때마다 만든다.

```sh
cupsfilter sample.txt > sample.pdf        # 텍스트 레이어 있는 PDF
head -c 6000 sample.pdf > truncated.pdf   # 깨진 PDF (A)
sips -s format pdf scan.png --out scanned.pdf   # 텍스트 레이어 없는 PDF
```

OCR용 이미지(여러 줄·좁은 행간·투명 배경·표·2단)는 `NSImage`에 글자를 그려 PNG로
쓰는 짧은 Swift 스크립트로 만든다. 행간과 배경 알파만 바꾸면 B·D 픽스처가 된다.

## 배경

규약(JSON 출력, stderr 한 줄, 종료 코드)과 레이아웃은 [README](../README.md)에,
각 Swift CLI의 설계 근거는 그 패키지의 README에 있다 — [translate](../swift/translate/README.md)(언어팩과 SwiftUI 우회), [vision](../swift/vision/README.md)(인식 옵션, 줄 병합, 투명 배경).
