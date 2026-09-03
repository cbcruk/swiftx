import Foundation

/// 값을 한 줄짜리 JSON 문자열로 인코딩한다.
///
/// - Throws: 인코딩에 실패하거나 UTF-8로 변환할 수 없을 때.
public func jsonString(_ value: some Encodable) throws -> String {
    let data = try JSONEncoder().encode(value)
    guard let text = String(data: data, encoding: .utf8) else {
        throw JSONOutputError.notUTF8
    }
    return text
}

/// 값을 한 줄짜리 JSON으로 stdout에 출력한다.
///
/// 줄바꿈 없는 단일 라인이므로, 반복 호출하면 그대로 NDJSON 스트림이 된다.
/// Node 쪽에서는 각각 `parseJson` / `parseJsonLines`로 받는다.
public func printJSON(_ value: some Encodable) {
    guard let text = try? jsonString(value) else {
        fail("failed to encode output as JSON", .failure)
    }
    print(text)
}

public enum JSONOutputError: Error, CustomStringConvertible {
    case notUTF8

    public var description: String {
        switch self {
        case .notUTF8: return "encoded JSON was not valid UTF-8"
        }
    }
}
