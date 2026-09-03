import { bundledBinaryDir, resolveSwiftBinary } from '@cbcruk/swift-bridge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export const VISION_OCR_BINARY = 'vision-ocr-cli'

/**
 * 실행할 vision-ocr-cli 경로.
 * `SWIFTX_VISION_OCR_CLI_BIN` → 모노레포 개발 빌드 → 패키지 동봉본 순.
 */
export function visionOcrBinary(explicit?: string): string {
  if (explicit !== undefined) return explicit

  return resolveSwiftBinary(VISION_OCR_BINARY, {
    bundledDirs: [bundledBinaryDir(import.meta.url)],
    devPackageRoots: [path.resolve(packageRoot, '..', '..', 'swift', 'vision')],
  })
}
