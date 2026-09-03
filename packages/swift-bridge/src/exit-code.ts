/**
 * swiftx CLI가 공유하는 종료 코드 규약. Swift 쪽 `SwiftXKit.ExitCode`와 짝이다.
 *
 * 각 CLI는 이 위에 자기 코드를 덧붙일 수 있으므로(예: translate-cli의 `5`),
 * 여기 없는 값이 올라올 수 있다. 그럴 때 사람이 읽을 메시지는
 * `runChecked`의 `exitCodeMessages`로 붙인다.
 */
export const SwiftExitCode = {
  /** 성공. */
  ok: 0,
  /** 잘못된 인자 사용. */
  usage: 1,
  /** 입력을 열거나 파싱할 수 없음. */
  input: 2,
  /** 요청한 기능을 이 환경에서 쓸 수 없음. */
  unavailable: 3,
  /** 그 밖의 실행 실패. */
  failure: 4,
} as const

export type SwiftExitCode = (typeof SwiftExitCode)[keyof typeof SwiftExitCode]
