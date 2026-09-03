import { bundledBinaryDir, resolveSwiftBinary } from '@cbcruk/swift-bridge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 이 패키지 루트 (dist/ 기준 한 단계 위). */
const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export const PDF_CLI_BINARY = 'pdf-cli'

/**
 * 실행할 pdf-cli 바이너리 경로. `SWIFTX_PDF_CLI_BIN` → 모노레포 개발 빌드 → 패키지 동봉본 순.
 *
 * @param explicit 호출부가 경로를 직접 아는 경우 그대로 쓴다
 */
export function pdfCliBinary(explicit?: string): string {
  if (explicit !== undefined) return explicit

  return resolveSwiftBinary(PDF_CLI_BINARY, {
    bundledDirs: [bundledBinaryDir(import.meta.url)],
    // 모노레포 안에서 개발할 때만 존재한다. 배포본에서는 조용히 건너뛴다.
    devPackageRoots: [path.resolve(packageRoot, '..', '..', 'swift', 'pdf')],
  })
}
