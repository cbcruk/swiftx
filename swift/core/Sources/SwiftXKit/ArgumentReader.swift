import Foundation

/// 플래그 위주의 간단한 명령줄 파서.
///
/// swiftx의 CLI들은 인자가 몇 개 안 되므로 외부 의존성(ArgumentParser) 대신
/// `ArraySlice.popFirst()` 패턴을 이 타입 하나로 통일한다. 값이 빠진 플래그처럼
/// 회복 불가능한 사용 오류는 `fail(_:.usage)`로 즉시 종료한다.
///
/// ```swift
/// var reader = ArgumentReader()
/// while let argument = reader.next() {
///     switch argument {
///     case "--scale": scale = reader.doubleValue(for: "--scale")
///     case "--languages": languages = reader.listValue(for: "--languages")
///     default: reader.takePositional(argument, into: &path)
///     }
/// }
/// ```
public struct ArgumentReader {
    private var arguments: ArraySlice<String>

    /// 기본값은 실행 파일 이름을 뺀 실제 명령줄 인자다.
    public init(_ arguments: [String] = Array(CommandLine.arguments.dropFirst())) {
        self.arguments = ArraySlice(arguments)
    }

    /// 남은 인자가 있는지.
    public var isEmpty: Bool { arguments.isEmpty }

    /// 다음 인자를 꺼낸다.
    public mutating func next() -> String? {
        arguments.popFirst()
    }

    /// 플래그의 값을 꺼낸다. 값이 없으면 사용 오류로 종료한다.
    public mutating func value(for flag: String) -> String {
        guard let value = arguments.popFirst() else {
            fail("\(flag) requires a value", .usage)
        }
        return value
    }

    /// 정수 값을 꺼낸다.
    public mutating func intValue(for flag: String) -> Int {
        let raw = value(for: flag)
        guard let parsed = Int(raw) else {
            fail("\(flag) requires an integer, got \(raw)", .usage)
        }
        return parsed
    }

    /// 실수 값을 꺼낸다.
    public mutating func doubleValue(for flag: String) -> Double {
        let raw = value(for: flag)
        guard let parsed = Double(raw) else {
            fail("\(flag) requires a number, got \(raw)", .usage)
        }
        return parsed
    }

    /// 쉼표로 구분된 값을 배열로 꺼낸다. 예: `--languages ko-KR,en-US`
    public mutating func listValue(for flag: String) -> [String] {
        value(for: flag)
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.isEmpty == false }
    }

    /// 위치 인자를 한 번만 받는다. 이미 채워져 있거나 `-`로 시작하면 사용 오류로 종료한다.
    public mutating func takePositional(_ argument: String, into destination: inout String?) {
        guard destination == nil, argument.hasPrefix("-") == false else {
            fail("unknown argument: \(argument)", .usage)
        }
        destination = argument
    }
}
