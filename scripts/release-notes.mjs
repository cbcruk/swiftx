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

function manifestOf(dir) {
  return JSON.parse(readFileSync(path.join(repoRoot, 'packages', dir, 'package.json'), 'utf8'))
}

// 브리지는 npm이 정본이라 릴리스에 붙이지 않는다 (docs/design.md).
const bridgeRange = `^${manifestOf('swift-bridge').version}`
const consumers = ['pdf-cli', 'translate-cli', 'vision-ocr'].map((dir) => {
  const manifest = manifestOf(dir)
  const tarball = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`

  if (!existsSync(path.join(tarballDir, tarball))) {
    console.error(`release-notes.mjs: tarball을 찾지 못했습니다: ${tarball}`)
    process.exit(1)
  }

  return { name: manifest.name, url: `${baseUrl}/${tarball}` }
})

console.log(`미리 빌드된 유니버설 바이너리(arm64 + x86_64)를 동봉한 tarball이다.
설치 시점에 Swift 툴체인이 필요하지 않다.

## 설치

필요한 패키지만 골라 \`dependencies\`에 넣는다. 그게 전부다.

\`\`\`json
{
  "dependencies": {
${consumers.map((entry) => `    "${entry.name}": "${entry.url}"`).join(',\n')}
  }
}
\`\`\`

브리지(\`${BRIDGE}\`)는 npm에서 전이 의존성으로 따라오므로 적지 않아도 된다.
\`SwiftCliError\`로 오류를 가르려면 직접 import해야 하니 그때만
\`"${BRIDGE}": "${bridgeRange}"\`을 함께 적는다.

바이너리를 동봉하는 나머지 셋은 위처럼 릴리스 tarball로만 배포한다. 왜 브리지만 레지스트리에 있는지는
[설계 노트](https://github.com/cbcruk/swiftx/blob/main/docs/design.md#왜-브리지만-npm에-올리나)에 있다.

## macOS 하한

\`vision-ocr\` macOS 13 · \`pdf-cli\`와 \`translate-cli\` macOS 26.`)
