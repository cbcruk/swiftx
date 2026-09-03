# 맥에서 확인할 것

이 리포의 Swift 코드는 Swift 툴체인이 없는 환경에서 작성됐다. TypeScript 쪽은 CLI 계약을
흉내내는 대역으로 검증되지만, **Swift는 컴파일조차 확인되지 않은 채 커밋된다.** 실제로
`package: "swiftx-core"`(디렉터리 이름인 `core`여야 한다) 같은 빌드 차단 버그가 맥에서야
드러났고, `pnpm test`로는 잡히지 않았다.

이 문서는 그 간극을 메우는 체크리스트다.

## 0. 시작 전

로컬에서 직접 고친 것이 있다면 먼저 정리한다. `package: "core"` 수정과 pbcopy 테스트
스텁은 이미 리포에 커밋돼 있어 충돌한다.

```sh
git status                     # 로컬 수정 확인
git checkout -- .              # 커밋 안 한 수정이 위 두 건뿐이면
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

CI(`.github/workflows/ci.yml`)가 push마다 같은 것을 돈다 — ubuntu에서 Node,
macos-26에서 Swift. 로컬에서 놓쳐도 여기서 한 번 더 걸린다.

## 2. 미검증 수정 (A–D)

맥 검증에서 나온 발견 네 건을 고쳤지만 **고친 결과는 아직 실제로 확인되지 않았다.**

### A. stderr에서 CLI 자신의 줄 고르기

CoreGraphics가 같은 stderr에 자기 진단을 먼저 흘려서 진짜 원인이 묻혔다. 이제 브릿지가
`<tool>: ` 접두사가 붙은 줄을 골라 쓴다.

```sh
node -e "
import('@cbcruk/pdf-cli').then(async ({ readPdfInfo }) => {
  try { await readPdfInfo('truncated.pdf') } catch (e) { console.log(e.message) }
})
"
```

기대: `pdf-cli exited with code 2: cannot open PDF: …`
(더 이상 `CoreGraphics PDF has logged an error…`가 아니다). 원문은 `error.stderr`에 남는다.

### B. 줄 병합 허용 오차

고정값 0.02 → **조각 높이의 0.5배**(높이 0이면 하한 0.004). 정렬에서 허용 오차를 걷어내
strict weak ordering을 회복했고, 줄 판정 기준을 직전 조각에서 현재 줄의 첫 조각으로 바꿨다.

```sh
swift test --package-path swift/vision
vision-ocr-cli sample.png | jq .lines
```

기대: 관측했던 5줄 문서가 5줄로 나오고 순서가 보존된다 (예전엔 3줄로 합쳐지고 1·2번이 뒤집혔다).

### C. `title` 키 존재

Swift `Optional`은 nil이면 키 자체를 생략한다. 이제 명시적으로 `null`을 내보낸다.

```sh
pdf-cli structure sample.pdf | jq '.pages[] | has("title")'
```

기대: 제목이 없는 페이지도 포함해 전부 `true`.

### D. 투명 배경 합성

알파 채널이 있으면 흰 배경 위로 합성한 뒤 인식한다.

```sh
vision-ocr-cli transparent.png | jq .text
```

기대: 예전에 빈 결과를 내던 투명 PNG에서 텍스트가 나온다. (합성 실패 시 원본으로 인식을
시도하므로, 어떤 경우에도 exit 0 + 빈 결과보다 나빠지지는 않는다.)

## 3. 아직 막혀 있는 검증

### 번역 언어팩

기기에 언어팩이 하나도 없어 `translate-cli`가 `--check`까지만 검증됐다.

```sh
translate-cli --source en --target ko --check
# {"status":"installed",...} 이어야 실제 번역 검증이 가능하다
```

시스템 설정 > 일반 > 언어 및 지역 > 번역 언어에서 English + 한국어를 받은 뒤:

```sh
echo '["Hello, world.","The quick brown fox."]' | translate-cli --source en --target ko
```

그다음 래퍼 쪽에서 확인할 것 — 청크 분할(`chunkSize`), `onProgress` 누적 개수,
`index` 기준 순서 보정, 결과 개수 부족 시 예외. 대역으로는 통과했지만 실제 번역으로
한 번 돌려봐야 한다.

### 실제 문서 픽스처

합성 픽스처로는 재현되지 않는 것들:

| 필요한 문서 | 확인할 것 |
|---|---|
| 텍스트 레이어 없는 스캔 한글 PDF | `hasTextLayer: false` 분기와 스캔 경로 전체 (미검증) |
| 실제 표가 있는 PDF | Vision이 표로 검출하는 하한. 4행짜리 작은 표는 문단으로 흘렀다 |
| 2단 레이아웃 문서 | vision-ocr 줄 병합이 무너지는 지점 |

## 4. 알려진 한계 (버그 아님)

- **다단 레이아웃** — 단을 가로질러 같은 높이에 있는 조각이 한 줄로 붙는다. B 수정으로도
  해결되지 않는다. 제대로 하려면 x 방향 군집(단 분리)이 필요하고, 별도 작업이다.
  구조가 필요하면 `pdf-cli structure` 쪽을 쓴다.
- **흰 글자 / 투명 배경** — D의 흰 배경 합성이 글자를 지운다. `flattenTransparency`의
  `background` 인자로 열려 있지만 CLI 플래그로는 노출하지 않았다.
- **작은 표** — Vision의 판정 기준이라 우리 쪽에서 고칠 수 없다. pdf-translator에
  "표 매칭 실패 시 고정폭 텍스트로 강등"하는 폴백이 있으니 그 경로가 실제로 도는지
  확인할 가치가 있다.

## 5. 다음 작업 순서

1. **pdf-translator 전환** — `file:` 링크로 `@cbcruk/pdf-cli`·`@cbcruk/translate-cli`를
   물려 실제 PDF로 파이프라인을 통과시킨다. 배포 전에 하는 게 되돌리기 가장 쉽다.
   `src/utils/{run-process,swift-binaries}.ts`와 `src/pipeline/ingest.types.ts`가 지워진다.
2. **npm 배포** — 아래 체크리스트.
3. **vision-ocr 리포 정리** — README를 swiftx로 넘기고 아카이브. 2.0.0의 마이그레이션
   노트는 `packages/vision-ocr/README.md`에 있다.

## 6. 릴리스 체크리스트

```sh
pnpm --filter @cbcruk/pdf-cli build:swift      # lipo → ad-hoc codesign → packages/pdf-cli/bin
pnpm --filter @cbcruk/pdf-cli pack             # prepack 가드가 바이너리 유무를 확인한다
```

- 유니버설 빌드는 `ARCHS` 환경변수로 줄일 수 있다 (`ARCHS=arm64`). macos-26 러너는
  arm64 전용이라 x86_64는 크로스 컴파일로 나온다 — 첫 릴리스에서 실패하면 여기를 본다.
- 배포는 `Release` 워크플로(workflow_dispatch)에서 패키지를 골라 돌린다.
  `NPM_TOKEN` 시크릿이 필요하다.
- `@cbcruk/vision-ocr`은 **2.0.0**이다. 1.x는 node-swift 애드온이라 실행 모델이 다르다.

## 배경

규약(JSON 출력, stderr 한 줄, 종료 코드)과 레이아웃은 [README](../README.md)에,
번역 CLI의 설계 근거는 [swift/translate/README.md](../swift/translate/README.md)에 있다.
