import { bundledBinaryDir, resolveSwiftBinary } from '@cbcruk/swift-bridge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export const TRANSLATE_CLI_BINARY = 'translate-cli'

/**
 * 실행할 translate-cli 바이너리 경로.
 * `SWIFTX_TRANSLATE_CLI_BIN` → 모노레포 개발 빌드 → 패키지 동봉본 순.
 */
export function translateCliBinary(explicit?: string): string {
  if (explicit !== undefined) return explicit

  return resolveSwiftBinary(TRANSLATE_CLI_BINARY, {
    bundledDirs: [bundledBinaryDir(import.meta.url)],
    devPackageRoots: [path.resolve(packageRoot, '..', '..', 'swift', 'translate')],
  })
}
