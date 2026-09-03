import CoreGraphics
import Foundation
import SwiftXKit
import Vision

/// 인식 결과. `text`는 `lines`를 개행으로 이은 것으로, 둘 다 같은 인식 한 번에서 나온다.
struct RecognizedText: Encodable {
    let lines: [String]
    let text: String
}

/// 같은 줄로 묶을 세로 허용 오차 (정규화 좌표 기준).
private let lineTolerance: CGFloat = 0.02

/// 인식된 텍스트 조각 하나와 그 위치.
///
/// Vision은 **좌하단 원점**의 정규화 좌표를 주므로 y를 뒤집어 위에서 아래로 읽는
/// 순서로 만든다. 그래서 `y`가 작을수록 페이지 위쪽이다.
private struct Fragment {
    let text: String
    let x: CGFloat
    let y: CGFloat
}

/// Vision으로 이미지에서 텍스트를 인식하고 줄 단위로 병합한다.
///
/// 조각들을 위→아래, 왼쪽→오른쪽으로 정렬한 뒤 세로 거리가 `lineTolerance` 안이면
/// 한 줄로 합친다. 표나 다단 레이아웃은 이 단순 병합으로 무너질 수 있다.
/// 구조가 필요하면 `pdf-cli structure`(RecognizeDocumentsRequest) 쪽을 쓴다.
///
/// - Parameters:
///   - image: 인식할 이미지
///   - languages: 인식 언어 우선순위 (BCP-47). 모델 선택과 언어 교정에 함께 쓰인다
func recognizeText(in image: CGImage, languages: [String]) throws -> RecognizedText {
    let request = VNRecognizeTextRequest()
    request.recognitionLanguages = languages
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    guard let observations = request.results else {
        return RecognizedText(lines: [], text: "")
    }

    let fragments: [Fragment] = observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        return Fragment(
            text: candidate.string,
            x: observation.boundingBox.minX,
            y: 1 - observation.boundingBox.midY
        )
    }

    let sorted = fragments.sorted { a, b in
        if abs(a.y - b.y) < lineTolerance {
            return a.x < b.x
        }
        return a.y < b.y
    }

    var lines: [String] = []
    var current: [String] = []
    var lastY: CGFloat = -1

    for fragment in sorted {
        if lastY >= 0, abs(fragment.y - lastY) > lineTolerance, current.isEmpty == false {
            lines.append(current.joined(separator: " "))
            current = []
        }
        current.append(fragment.text)
        lastY = fragment.y
    }
    if current.isEmpty == false {
        lines.append(current.joined(separator: " "))
    }

    return RecognizedText(lines: lines, text: lines.joined(separator: "\n"))
}
