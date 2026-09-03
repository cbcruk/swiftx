export {
  SwiftBinaryNotFoundError,
  SwiftCliError,
  SwiftOutputError,
  SwiftTimeoutError,
  type SwiftCliErrorInfo,
} from './errors.js'

export { SwiftExitCode } from './exit-code.js'

export {
  ensureSuccess,
  runChecked,
  runCheckedSync,
  runProcess,
  runProcessSync,
  type CheckedRunOptions,
  type ProcessResult,
  type RunOptions,
} from './run-process.js'

export { parseJson, parseJsonLines, runJson, runJsonLines, runJsonSync } from './json.js'

export {
  bundledBinaryDir,
  resolveSwiftBinary,
  swiftBinaryEnvVar,
  type ResolveSwiftBinaryOptions,
} from './resolve-binary.js'
