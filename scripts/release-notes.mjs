#!/usr/bin/env node
// GitHub 릴리스 본문을 만든다. 소비 측이 그대로 복사할 수 있는 설치 스니펫이 핵심이다.
//   node scripts/release-notes.mjs <tarball-dir> <download-base-url>
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [tarballDir, baseUrl] = process.argv.slice(2)
if (tarballDir === undefined || baseUrl === undefined) {
  console.error('usage: release-notes.mjs <tarball-dir> <download-base-url>')
  process.exit(1)
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const BRIDGE = '@cbcruk/swift-bridge'
const packages = ['swift-bridge', 'pdf-cli', 'translate-cli', 'vision-ocr'].map((dir) => {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages', dir, 'package.json'), 'utf8')
  )
  const tarball = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`

  if (!existsSync(path.join(tarballDir, tarball))) {
    console.error(`release-notes.mjs: tarball을 찾지 못했습니다: ${tarball}`)
    process.exit(1)
  }

  return { name: manifest.name, url: `${baseUrl}/${tarball}` }
})

const url = (name) => packages.find((entry) => entry.name === name).url

console.log(`미리 빌드된 유니버설 바이너리(arm64 + x86_64)를 동봉한 tarball이다.
설치 시점에 Swift 툴체인이 필요하지 않다.

## 설치

필요한 패키지만 골라 \`dependencies\`에 넣고, \`overrides\`는 그대로 둔다.

\`\`\`json
{
  "dependencies": {
${packages.map((entry) => `    "${entry.name}": "${entry.url}"`).join(',\n')}
  },
  "pnpm": {
    "overrides": {
      "${BRIDGE}": "${url(BRIDGE)}"
    }
  }
}
\`\`\`

npm을 쓴다면 \`pnpm.overrides\` 대신 최상위 \`overrides\`에 같은 줄을 넣는다.

## swift-bridge가 두 번 나오는 이유

래퍼 패키지들은 \`${BRIDGE}\`를 \`^0.1.0\`으로 요구한다. npm 레지스트리에 없는
이름이라 override 없이는 설치가 404로 죽는다. override는 그걸 이 릴리스의 tarball로
고정하고, 덕분에 사본이 하나로 모여 \`instanceof SwiftCliError\`가 패키지 경계를
넘어서도 성립한다.

\`dependencies\` 쪽 한 줄은 별개다. override만으로는 브릿지가 최상위
\`node_modules\`에 노출되지 않아서, \`SwiftCliError\`를 직접 import하려면
의존성으로도 선언해야 한다. 오류를 종료 코드로 가르지 않는다면 빼도 된다.

## macOS 하한

\`vision-ocr\` macOS 13 · \`pdf-cli\`와 \`translate-cli\` macOS 26.`)
