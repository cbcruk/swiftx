import CoreGraphics
import Foundation

/// Node로 넘기는 사각형. Vision의 정규화 좌표를 페이지/이미지 좌표로 되돌린 값이다.
public struct Box: Encodable, Equatable, Sendable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

/// 정규화된 사각형(0...1)을 주어진 경계의 좌표계로 환산한다.
///
/// Vision은 좌하단 원점의 정규화 좌표를 돌려주므로, 원점 규약을 바꾸지 않고
/// 배율만 되돌린다. 위에서 아래로 읽는 순서가 필요한 쪽에서 `1 - y`를 적용한다.
public func denormalize(_ rect: CGRect, in bounds: CGRect) -> Box {
    Box(
        x: Double(rect.minX * bounds.width),
        y: Double(rect.minY * bounds.height),
        width: Double(rect.width * bounds.width),
        height: Double(rect.height * bounds.height)
    )
}
