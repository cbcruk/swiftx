import Foundation

/// CLI 종료 코드.
///
/// `enum`이 아니라 확장 가능한 `struct`인 이유는, 공통 코드(0~4)를 여기서 고정하되
/// 각 CLI가 자기 도메인의 코드를 정적 멤버로 덧붙일 수 있어야 하기 때문이다.
///
/// ```swift
/// extension ExitCode {
///     static let languagePackMissing = ExitCode(5)
/// }
/// ```
public struct ExitCode: RawRepresentable, Equatable, Sendable {
    public let rawValue: Int32

    public init(rawValue: Int32) {
        self.rawValue = rawValue
    }

    public init(_ rawValue: Int32) {
        self.rawValue = rawValue
    }

    /// 성공.
    public static let ok = ExitCode(0)
    /// 잘못된 인자 사용.
    public static let usage = ExitCode(1)
    /// 입력을 열거나 파싱할 수 없음.
    public static let input = ExitCode(2)
    /// 요청한 기능을 이 환경에서 쓸 수 없음 (미설치 언어팩, 미지원 OS 등).
    public static let unavailable = ExitCode(3)
    /// 그 밖의 실행 실패.
    public static let failure = ExitCode(4)
}

/// 진단 메시지 앞에 붙일 도구 이름. 기본값은 실행 파일 이름이다.
public enum SwiftXTool {
    public static var name: String {
        guard let path = CommandLine.arguments.first else { return "swiftx" }
        let base = URL(fileURLWithPath: path).lastPathComponent
        return base.isEmpty ? "swiftx" : base
    }
}

/// stderr에 `<tool>: <message>`를 쓰고 지정한 코드로 종료한다.
///
/// Node 쪽 브릿지(`@cbcruk/swift-bridge`)는 stderr 첫 줄을 에러 메시지로 삼으므로,
/// 실패 원인은 반드시 한 줄로 먼저 쓴다.
public func fail(_ message: String, _ code: ExitCode = .failure) -> Never {
    FileHandle.standardError.write(Data("\(SwiftXTool.name): \(message)\n".utf8))
    exit(code.rawValue)
}
