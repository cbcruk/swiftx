#!/usr/bin/env node
// 동봉 바이너리 없이 패키지가 배포되는 사고를 막는다 (prepack 훅).
//   node scripts/check-bundled-binary.mjs <package-dir> <binary-name>
import { accessSync, constants, statSync } from 'node:fs'
import path from 'node:path'

const [packageDir, binaryName] = process.argv.slice(2)
if (packageDir === undefined || binaryName === undefined) {
  console.error('usage: check-bundled-binary.mjs <package-dir> <binary-name>')
  process.exit(1)
}

const binary = path.resolve(packageDir, 'bin', binaryName)

try {
  if (!statSync(binary).isFile()) throw new Error('not a file')
  accessSync(binary, constants.X_OK)
} catch {
  console.error(
    `${binaryName}: 동봉할 바이너리가 없습니다: ${binary}\n` +
      `먼저 macOS에서 \`pnpm --filter <package> build:swift\`를 실행하세요.`
  )
  process.exit(1)
}

console.log(`bundled binary ok: ${binary}`)
