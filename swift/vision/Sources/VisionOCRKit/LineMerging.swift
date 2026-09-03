import CoreGraphics
import Foundation

/// 인식된 텍스트 조각 하나와 그 위치.
///
/// 좌표는 모두 정규화(0...1)다. `y`는 Vision의 좌하단 원점을 뒤집은 값이라
/// **작을수록 페이지 위쪽**이다.
public struct TextFragment: Equatable {
    public let text: String
    /// 조각 왼쪽 끝의 x.
    public let x: CGFloat
    /// 조각 중심의 y (위에서 아래로).
    public let y: CGFloat
    /// 조각의 높이. 줄 판정 허용 오차를 여기서 끌어온다.
    public let height: CGFloat

    public init(text: String, x: CGFloat, y: CGFloat, height: CGFloat) {
        self.text = text
        self.x = x
        self.y = y
        self.height = height
    }
}

/// 같은 줄로 볼 세로 허용 오차를 글자 높이에 대한 비율로 정한다.
///
/// 고정값(예전의 0.02)은 쓸 수 없다. 좌표가 정규화돼 있어 이미지를 키워도 비율이
/// 그대로이므로, 줄 간격이 촘촘한 문서에서는 인접한 모든 줄이 한 줄로 붙어버린다.
/// 실제 줄 간격은 글자 높이에 비례하니 허용 오차도 거기서 끌어온다.
private let lineToleranceRatio: CGFloat = 0.5

/// 높이를 못 얻은 조각(height = 0)에서 모든 조각이 제각각 줄이 되는 것을 막는 하한.
private let minimumLineTolerance: CGFloat = 0.004

/// 텍스트 조각들을 읽기 순서의 줄들로 묶는다.
///
/// 다단 레이아웃은 이 모델로 살아남지 못한다. 단을 가로질러 같은 높이에 있는 조각들이
/// 한 줄로 합쳐진다. 구조가 필요하면 `pdf-cli structure` 쪽을 쓴다.
public func mergeIntoLines(_ fragments: [TextFragment]) -> [String] {
    // 1) y로만 정렬한다. 허용 오차를 비교자에 넣으면 "a==b, b==c, a≠c"가 생겨
    //    strict weak ordering이 깨지고, 정렬 결과가 입력 순서에 따라 달라진다.
    let sorted = fragments.sorted { a, b in
        if a.y != b.y { return a.y < b.y }
        return a.x < b.x
    }

    // 2) 줄로 묶는다. 기준은 직전 조각이 아니라 **현재 줄의 첫 조각**이다.
    //    직전 조각과 비교하면 허용 오차가 조금씩 누적되어 문단 전체가 한 줄로 흘러간다.
    var lines: [[TextFragment]] = []
    var current: [TextFragment] = []
    var lineY: CGFloat = 0
    var lineHeight: CGFloat = 0

    for fragment in sorted {
        if current.isEmpty {
            current = [fragment]
            lineY = fragment.y
            lineHeight = fragment.height
            continue
        }

        let basis = max(lineHeight, fragment.height)
        let tolerance = max(minimumLineTolerance, basis * lineToleranceRatio)

        if abs(fragment.y - lineY) <= tolerance {
            current.append(fragment)
            lineHeight = max(lineHeight, fragment.height)
        } else {
            lines.append(current)
            current = [fragment]
            lineY = fragment.y
            lineHeight = fragment.height
        }
    }
    if current.isEmpty == false {
        lines.append(current)
    }

    // 3) 줄 안에서는 왼쪽에서 오른쪽으로 읽는다.
    return lines.map { line in
        line.sorted { $0.x < $1.x }.map(\.text).joined(separator: " ")
    }
}
