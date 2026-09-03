import AppKit
import CoreGraphics
import Foundation
import SwiftXKit
import VisionOCRKit

extension ExitCode {
    /// 클립보드에 이미지가 없다. 사용자가 바로 고칠 수 있는 실패라 따로 구분한다.
    static let clipboardEmpty = ExitCode(5)
}

/// 이미지를 어디서 읽을지.
private enum Source {
    case file(String)
    case clipboard
    case standardInput
}

@main
struct VisionOCRCLI {
    static func main() {
        var path: String?
        var useClipboard = false
        var useStandardInput = false
        var languages = ["ko-KR", "en-US"]

        var reader = ArgumentReader()
        while let argument = reader.next() {
            switch argument {
            case "--clipboard":
                useClipboard = true
            case "--stdin":
                useStandardInput = true
            case "--languages":
                languages = reader.listValue(for: argument)
            case "--help", "-h":
                printUsage()
                exit(ExitCode.ok.rawValue)
            default:
                reader.takePositional(argument, into: &path)
            }
        }

        let image: CGImage
        do {
            // 투명 배경은 Vision이 사실상 읽지 못한다. 빈 결과로 조용히 끝나는 대신
            // 흰 배경을 깔고 인식한다.
            image = flattenTransparency(
                try loadImage(from: resolveSource(path, useClipboard, useStandardInput))
            )
        } catch let error as ImageLoadingError {
            fail("\(error)", .input)
        } catch {
            fail("cannot read image: \(error)", .input)
        }

        do {
            printJSON(try recognizeText(in: image, languages: languages))
        } catch {
            fail("text recognition failed: \(error)", .failure)
        }

        exit(ExitCode.ok.rawValue)
    }

    /// 입력 출처는 정확히 하나여야 한다. 기본값을 두지 않는 것은, 클립보드를 말없이
    /// 읽는 동작이 사람용 CLI에는 편해도 프로그램 호출에는 놀라운 기본값이기 때문이다.
    private static func resolveSource(
        _ path: String?,
        _ useClipboard: Bool,
        _ useStandardInput: Bool
    ) -> Source {
        let selected = [path != nil, useClipboard, useStandardInput].filter { $0 }.count
        guard selected == 1 else {
            fail("expected exactly one of <image>, --clipboard, --stdin", .usage)
        }
        if let path { return .file(path) }
        if useClipboard { return .clipboard }
        return .standardInput
    }

    private static func loadImage(from source: Source) throws -> CGImage {
        switch source {
        case .file(let path):
            return try loadCGImage(contentsOf: URL(fileURLWithPath: path))
        case .standardInput:
            guard let data = try FileHandle.standardInput.readToEnd(), data.isEmpty == false else {
                fail("expected image data on stdin", .usage)
            }
            return try loadCGImage(data: data)
        case .clipboard:
            return try loadCGImage(data: clipboardImageData())
        }
    }

    /// 시스템 페이스트보드에서 PNG, TIFF, 파일 URL 순으로 이미지를 찾는다.
    private static func clipboardImageData() -> Data {
        let pasteboard = NSPasteboard.general

        if let data = pasteboard.data(forType: .png) { return data }
        if let data = pasteboard.data(forType: .tiff) { return data }

        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
            let url = urls.first,
            let data = try? Data(contentsOf: url)
        {
            return data
        }

        fail("no image found in clipboard", .clipboardEmpty)
    }

    static func printUsage() {
        print("""
        usage: vision-ocr-cli (<image> | --clipboard | --stdin) [--languages ko-KR,en-US]

        Recognizes text with Vision (VNRecognizeTextRequest) and prints
        {"lines":[...],"text":"..."} as JSON. Fragments are sorted top-to-bottom,
        left-to-right and merged into lines; "text" joins those lines with newlines.

        Recognizing nothing is not an error: it prints an empty result and exits 0.

        exit codes: 0 ok, 1 usage error, 2 cannot read/decode the image,
                    4 recognition failure, 5 no image in the clipboard.
        """)
    }
}
