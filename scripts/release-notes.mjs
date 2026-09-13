#!/usr/bin/env node
// GitHub 릴리스 본문을 만든다. 이 태그에서 레지스트리에 있는 버전과 설치 명령이 핵심이다.
//   node scripts/release-notes.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const BRIDGE = '@cbcruk/swift-bridge'

function manifestOf(dir) {
  return JSON.parse(readFileSync(path.join(repoRoot, 'packages', dir, 'package.json'), 'utf8'))
}

const bridge = manifestOf('swift-bridge')
const packages = ['pdf-cli', 'translate-cli', 'vision-ocr', 'swift-bridge'].map(manifestOf)

console.log(`## 패키지

| 패키지 | 버전 |
|---|---|
${packages.map((manifest) => `| [\`${manifest.name}\`](https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}) | ${manifest.version} |`).join('\n')}

## 설치

필요한 래퍼만 골라 설치한다. 미리 빌드된 유니버설 바이너리(arm64 + x86_64)가 들어 있어
설치 시점에 Swift 툴체인이 필요하지 않다.

\`\`\`sh
pnpm add ${packages.filter((manifest) => manifest.name !== BRIDGE).map((manifest) => manifest.name).join(' ')}
\`\`\`

브리지(\`${BRIDGE}\`)는 전이 의존성으로 따라온다. \`SwiftCliError\`로 오류를 가르려면
직접 import해야 하니 그때만 \`"${BRIDGE}": "^${bridge.version}"\`을 함께 적는다.

## macOS 하한

\`vision-ocr\` macOS 13 · \`pdf-cli\`와 \`translate-cli\` macOS 26.`)
