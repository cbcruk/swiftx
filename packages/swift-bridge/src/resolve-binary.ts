import { accessSync, constants, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SwiftBinaryNotFoundError } from './errors.js'

/** `resolveSwiftBinary`가 후보 경로를 만드는 방법. 모두 선택이며 지정한 것만 탐색한다. */
export interface ResolveSwiftBinaryOptions {
  /** npm 패키지에 동봉된 바이너리 디렉터리. 보통 `bundledBinaryDir(import.meta.url)`. */
  bundledDirs?: readonly string[]
  /** 개발 중 SwiftPM 산출물을 찾을 Swift 패키지 루트들 (`<root>/.build/...`). */
  devPackageRoots?: readonly string[]
  /** 경로를 강제할 환경변수 이름. 기본값은 `swiftBinaryEnvVar(name)`. */
  envVar?: string
  /** 환경변수 출처. 기본 `process.env` (테스트에서 주입한다). */
  env?: NodeJS.ProcessEnv
}

/** `pdf-cli` → `SWIFTX_PDF_CLI_BIN`. 바이너리별 경로 강제용 환경변수 이름 규약. */
export function swiftBinaryEnvVar(name: string): string {
  return `SWIFTX_${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_BIN`
}

/**
 * 패키지에 동봉된 바이너리 디렉터리의 절대 경로.
 * 래퍼 패키지에서 `bundledBinaryDir(import.meta.url)`로 호출하면
 * 빌드 산출물(`dist/`) 기준 `../bin`을 가리킨다.
 */
export function bundledBinaryDir(importMetaUrl: string, relative = '../bin'): string {
  return fileURLToPath(new URL(relative, importMetaUrl))
}

/** 존재하고, 일반 파일이고, 실행 가능한 경우에만 수정 시각을 돌려준다. */
function executableMtime(candidate: string): number | undefined {
  try {
    const stats = statSync(candidate)
    if (!stats.isFile()) return undefined
    accessSync(candidate, constants.X_OK)
    return stats.mtimeMs
  } catch {
    return undefined
  }
}

/**
 * SwiftPM 빌드 산출물의 후보 경로들.
 *
 * `.build/{release,debug}`는 보통 `.build/<triple>/{release,debug}`로 가는 심볼릭 링크지만,
 * 링크가 없거나 다른 triple로 빌드한 산출물이 남아 있는 경우까지 잡기 위해 둘 다 훑는다.
 */
function devCandidates(packageRoot: string, name: string): string[] {
  const buildDir = path.join(packageRoot, '.build')
  const configurationDirs = ['release', 'debug'].map((configuration) =>
    path.join(buildDir, configuration)
  )

  try {
    for (const entry of readdirSync(buildDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'release' || entry.name === 'debug') continue
      for (const configuration of ['release', 'debug']) {
        configurationDirs.push(path.join(buildDir, entry.name, configuration))
      }
    }
  } catch {
    // .build가 없으면 개발 빌드 후보도 없다.
  }

  return configurationDirs.map((dir) => path.join(dir, name))
}

/**
 * 실행할 Swift 바이너리의 절대 경로를 찾는다.
 *
 * 우선순위는 `환경변수 → 개발 빌드(가장 최근 것) → 패키지 동봉본`이다.
 * 개발 빌드를 동봉본보다 앞에 두는 이유는, 모노레포에서 방금 `swift build`한 결과가
 * 배포본을 가려야 수정→확인 루프가 돌기 때문이다.
 *
 * @param name 바이너리 겸 실행 파일 이름 (예: `pdf-cli`)
 * @throws 어느 후보에서도 못 찾으면 탐색 경로 목록을 담은 `SwiftBinaryNotFoundError`
 */
export function resolveSwiftBinary(
  name: string,
  options: ResolveSwiftBinaryOptions = {}
): string {
  const env = options.env ?? process.env
  const envVar = options.envVar ?? swiftBinaryEnvVar(name)
  const searched: string[] = []

  const override = env[envVar]
  if (override !== undefined && override !== '') {
    if (executableMtime(override) !== undefined) return override
    throw new SwiftBinaryNotFoundError(
      name,
      [override],
      `${envVar} is set but does not point to an executable file.`
    )
  }

  const devBinaries: Array<{ binary: string; modifiedAt: number }> = []
  for (const root of options.devPackageRoots ?? []) {
    for (const candidate of devCandidates(root, name)) {
      searched.push(candidate)
      const modifiedAt = executableMtime(candidate)
      if (modifiedAt !== undefined) devBinaries.push({ binary: candidate, modifiedAt })
    }
  }

  const newest = devBinaries.sort((a, b) => b.modifiedAt - a.modifiedAt)[0]
  if (newest !== undefined) return newest.binary

  for (const dir of options.bundledDirs ?? []) {
    const candidate = path.join(dir, name)
    searched.push(candidate)
    if (executableMtime(candidate) !== undefined) return candidate
  }

  throw new SwiftBinaryNotFoundError(
    name,
    searched,
    `Build it with \`swift build -c release\`, or set ${envVar} to an explicit path.`
  )
}
