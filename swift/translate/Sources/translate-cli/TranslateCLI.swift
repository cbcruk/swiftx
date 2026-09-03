import Foundation
import SwiftXKit
import Translation

struct TranslatedLine: Encodable {
    let index: Int
    let sourceText: String
    let targetText: String
}

struct CheckResult: Encodable {
    let status: String
    let source: String
    let target: String
}

extension ExitCode {
    /// 언어 쌍 자체는 지원되지만 언어팩이 설치되어 있지 않다.
    /// `.unavailable`(지원하지 않음)과 구분해야 호출부가 "설치하면 된다"고 안내할 수 있다.
    static let languagePackMissing = ExitCode(5)
}

@main
struct TranslateCLI {
    static func main() async {
        await run()
    }

    nonisolated static func run() async {
        var source = "en"
        var target = "ko"
        var checkOnly = false

        var reader = ArgumentReader()
        while let argument = reader.next() {
            switch argument {
            case "--source":
                source = reader.value(for: argument)
            case "--target":
                target = reader.value(for: argument)
            case "--check":
                checkOnly = true
            case "--help", "-h":
                printUsage()
                exit(ExitCode.ok.rawValue)
            default:
                fail("unknown argument: \(argument)", .usage)
            }
        }

        let sourceLanguage = Locale.Language(identifier: source)
        let targetLanguage = Locale.Language(identifier: target)

        let availability = LanguageAvailability()
        let status = await availability.status(from: sourceLanguage, to: targetLanguage)

        if checkOnly {
            printJSON(CheckResult(status: statusName(status), source: source, target: target))
            exit(ExitCode.ok.rawValue)
        }

        switch status {
        case .installed:
            break
        case .supported:
            fail(
                "language pair \(source)->\(target) is supported but not installed. "
                    + "Install via System Settings > General > Language & Region > Translation Languages, "
                    + "or open the Translate app and download both languages.",
                .languagePackMissing
            )
        case .unsupported:
            fail("language pair \(source)->\(target) is not supported", .unavailable)
        @unknown default:
            fail("unknown availability status for \(source)->\(target)", .unavailable)
        }

        let texts = readInputTexts()
        if texts.isEmpty {
            exit(ExitCode.ok.rawValue)
        }

        let session = TranslationSession(installedSource: sourceLanguage, target: targetLanguage)
        let requests = texts.map { TranslationSession.Request(sourceText: $0) }

        do {
            let responses = try await session.translations(from: requests)
            for (index, response) in responses.enumerated() {
                printJSON(TranslatedLine(
                    index: index,
                    sourceText: response.sourceText,
                    targetText: response.targetText
                ))
            }
        } catch {
            fail("translation failed: \(error)", .failure)
        }

        exit(ExitCode.ok.rawValue)
    }

    static func readInputTexts() -> [String] {
        guard let data = try? FileHandle.standardInput.readToEnd(), !data.isEmpty else {
            fail("expected a JSON array of strings on stdin", .usage)
        }
        guard let texts = try? JSONDecoder().decode([String].self, from: data) else {
            fail("stdin is not a valid JSON array of strings", .usage)
        }
        return texts
    }

    static func statusName(_ status: LanguageAvailability.Status) -> String {
        switch status {
        case .installed: return "installed"
        case .supported: return "supported"
        case .unsupported: return "unsupported"
        @unknown default: return "unknown"
        }
    }

    static func printUsage() {
        print("""
        usage: translate-cli [--source <lang>] [--target <lang>] [--check]

        Reads a JSON array of strings from stdin and writes one JSON object
        per line ({"index","sourceText","targetText"}) to stdout, in input order.
        Defaults: --source en --target ko.

        --check  print language pair availability as JSON and exit.

        exit codes: 0 ok, 1 usage/input error, 3 pair unsupported,
                    4 translation failure, 5 pair supported but not installed.
        """)
    }
}
