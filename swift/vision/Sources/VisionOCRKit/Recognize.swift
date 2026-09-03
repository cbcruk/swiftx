import CoreGraphics
import Foundation
import Vision

/// 인식 결과. `text`는 `lines`를 개행으로 이은 것으로, 둘 다 같은 인식 한 번에서 나온다.
public struct RecognizedText: Encodable, Equatable {
    public let lines: [String]
    public let text: String

    public init(lines: [String]) {
        self.lines = lines
        self.text = lines.joined(separator: "\n")
    }
}

/// Vision으로 이미지에서 텍스트를 인식하고 줄 단위로 병합한다.
///
/// - Parameters:
///   - image: 인식할 이미지
///   - languages: 인식 언어 우선순위 (BCP-47). 모델 선택과 언어 교정에 함께 쓰인다
/// - Returns: 읽기 순서로 병합된 줄들. 인식된 글자가 없으면 빈 결과
public func recognizeText(in image: CGImage, languages: [String]) throws -> RecognizedText {
    let request = VNRecognizeTextRequest()
    request.recognitionLanguages = languages
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    guard let observations = request.results else {
        return RecognizedText(lines: [])
    }

    let fragments: [TextFragment] = observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return TextFragment(
            text: candidate.string,
            x: box.minX,
            // Vision은 좌하단 원점이므로 뒤집어 위에서 아래로 읽는 순서로 만든다.
            y: 1 - box.midY,
            height: box.height
        )
    }

    return RecognizedText(lines: mergeIntoLines(fragments))
}
