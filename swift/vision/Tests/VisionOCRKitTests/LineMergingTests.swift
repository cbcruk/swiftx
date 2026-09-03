import CoreGraphics
import XCTest

@testable import VisionOCRKit

final class LineMergingTests: XCTestCase {
    /// 본문 크기 글자. 실제 관측값에 가깝게 잡았다.
    private let bodyHeight: CGFloat = 0.014

    private func fragment(_ text: String, x: CGFloat, y: CGFloat, height: CGFloat? = nil)
        -> TextFragment
    {
        TextFragment(text: text, x: x, y: y, height: height ?? bodyHeight)
    }

    func testEmptyInput() {
        XCTAssertEqual(mergeIntoLines([]), [])
    }

    func testFragmentsOnTheSameLineMergeLeftToRight() {
        let merged = mergeIntoLines([
            fragment("world", x: 0.5, y: 0.100),
            fragment("Hello", x: 0.1, y: 0.101),
        ])

        XCTAssertEqual(merged, ["Hello world"])
    }

    /// 예전 고정 허용 오차(0.02)가 통째로 합쳐버리던 실제 사례.
    /// 줄 간격 0.016은 0.02보다 작아 세 줄이 한 줄로 붙고 순서까지 뒤집혔다.
    func testTightlySpacedLinesStaySeparateAndOrdered() {
        let merged = mergeIntoLines([
            fragment("Hello Vision OCR", x: 0.1, y: 0.0312),
            fragment("This is a test document.", x: 0.1, y: 0.0472),
            fragment("The quick brown fox.", x: 0.1, y: 0.0633),
        ])

        XCTAssertEqual(merged, [
            "Hello Vision OCR",
            "This is a test document.",
            "The quick brown fox.",
        ])
    }

    /// 줄 판정 기준이 "직전 조각"이면 허용 오차가 누적되어 문단 전체가 한 줄로 흘러간다.
    /// 기준은 현재 줄의 첫 조각이어야 한다.
    func testToleranceDoesNotDriftAcrossFragments() {
        let height: CGFloat = 0.02  // 허용 오차 0.01
        let merged = mergeIntoLines([
            fragment("a", x: 0.1, y: 0.000, height: height),
            fragment("b", x: 0.2, y: 0.009, height: height),
            fragment("c", x: 0.3, y: 0.018, height: height),
        ])

        XCTAssertEqual(merged, ["a b", "c"])
    }

    /// 허용 오차는 글자 높이에 비례한다. 같은 간격이라도 큰 글자는 한 줄로 본다.
    func testToleranceScalesWithGlyphHeight() {
        let gap: CGFloat = 0.02

        let small = mergeIntoLines([
            fragment("a", x: 0.1, y: 0, height: 0.01),
            fragment("b", x: 0.2, y: gap, height: 0.01),
        ])
        let large = mergeIntoLines([
            fragment("a", x: 0.1, y: 0, height: 0.08),
            fragment("b", x: 0.2, y: gap, height: 0.08),
        ])

        XCTAssertEqual(small, ["a", "b"])
        XCTAssertEqual(large, ["a b"])
    }

    /// 높이를 못 얻은 조각(0)이 와도 모든 조각이 제각각 줄이 되지 않는다.
    func testZeroHeightFallsBackToMinimumTolerance() {
        let merged = mergeIntoLines([
            fragment("a", x: 0.1, y: 0.000, height: 0),
            fragment("b", x: 0.2, y: 0.002, height: 0),
            fragment("c", x: 0.3, y: 0.050, height: 0),
        ])

        XCTAssertEqual(merged, ["a b", "c"])
    }

    /// 비교자가 strict weak ordering이면 입력 순서가 결과를 바꾸지 않는다.
    func testResultIsIndependentOfInputOrder() {
        let fragments = [
            fragment("one", x: 0.1, y: 0.0312),
            fragment("two", x: 0.5, y: 0.0312),
            fragment("three", x: 0.1, y: 0.0472),
            fragment("four", x: 0.1, y: 0.0633),
        ]
        let expected = ["one two", "three", "four"]

        XCTAssertEqual(mergeIntoLines(fragments), expected)
        XCTAssertEqual(mergeIntoLines(fragments.reversed()), expected)
        XCTAssertEqual(mergeIntoLines([fragments[2], fragments[0], fragments[3], fragments[1]]), expected)
    }

    func testHeadingAboveBodyStaysSeparate() {
        let merged = mergeIntoLines([
            fragment("제목", x: 0.1, y: 0.05, height: 0.04),
            fragment("본문 첫 줄", x: 0.1, y: 0.12),
        ])

        XCTAssertEqual(merged, ["제목", "본문 첫 줄"])
    }
}
