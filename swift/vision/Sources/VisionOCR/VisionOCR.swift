import AppKit
import NodeAPI
import Vision

/// A single recognized text element with its position.
struct OCRLine {
    let text: String
    let y: CGFloat
    let x: CGFloat
}

/// Performs OCR on the given image data using the Vision framework.
///
/// Text observations are sorted top-to-bottom, left-to-right, and
/// lines within a vertical threshold of `0.02` are merged.
///
/// - Parameter imageData: Raw image data (PNG, TIFF, etc.).
/// - Returns: Recognized text with lines joined by newlines.
/// - Throws: An error if the image cannot be loaded or OCR fails.
func performOCR(imageData: Data) throws -> String {
    guard let image = NSImage(data: imageData),
        let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else {
        throw NSError(
            domain: "VisionOCR", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to load image"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    guard let observations = request.results else { return "" }

    let lines: [OCRLine] = observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let y = 1 - observation.boundingBox.midY
        let x = observation.boundingBox.minX
        return OCRLine(text: candidate.string, y: y, x: x)
    }

    let sortedLines = lines.sorted { a, b in
        if abs(a.y - b.y) < 0.02 {
            return a.x < b.x
        }
        return a.y < b.y
    }

    var result: [[String]] = []
    var currentLine: [String] = []
    var lastY: CGFloat = -1

    for line in sortedLines {
        if lastY >= 0 && abs(line.y - lastY) > 0.02 {
            if !currentLine.isEmpty {
                result.append(currentLine)
                currentLine = []
            }
        }
        currentLine.append(line.text)
        lastY = line.y
    }

    if !currentLine.isEmpty {
        result.append(currentLine)
    }

    return result.map { $0.joined(separator: " ") }.joined(separator: "\n")
}

/// Node.js-exported class providing OCR capabilities.
@NodeClass final class VisionOCR {

    @NodeConstructor init() {}

    /// Extracts text from raw image data.
    ///
    /// - Parameter data: Image data passed as a Node.js `Buffer`.
    /// - Returns: Recognized text.
    @NodeMethod static func recognizeText(_ data: Data) throws -> String {
        return try performOCR(imageData: data)
    }

    /// Extracts text from an image file.
    ///
    /// - Parameter path: Absolute path to the image file.
    /// - Returns: Recognized text.
    @NodeMethod static func recognizeTextFromFile(_ path: String) throws -> String {
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        return try performOCR(imageData: data)
    }

    /// Extracts text from the current clipboard image.
    ///
    /// Attempts to read PNG, TIFF, or file URL data from the system pasteboard.
    ///
    /// - Returns: Recognized text.
    /// - Throws: An error if no image is found in the clipboard.
    @NodeMethod static func recognizeTextFromClipboard() throws -> String {
        let pasteboard = NSPasteboard.general

        if let data = pasteboard.data(forType: .png) {
            return try performOCR(imageData: data)
        }

        if let data = pasteboard.data(forType: .tiff) {
            return try performOCR(imageData: data)
        }

        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
            let url = urls.first
        {
            let data = try Data(contentsOf: url)
            return try performOCR(imageData: data)
        }

        throw NSError(
            domain: "VisionOCR", code: 2,
            userInfo: [NSLocalizedDescriptionKey: "No image found in clipboard"])
    }
}

#NodeModule(exports: ["VisionOCR": VisionOCR.deferredConstructor])
