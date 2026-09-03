import CoreGraphics
import Foundation
import ImageIO

public enum ImageLoadingError: Error, CustomStringConvertible {
    case unreadable

    public var description: String {
        switch self {
        case .unreadable: return "failed to load image"
        }
    }
}

/// 이미지 데이터(PNG, TIFF, JPEG 등)를 `CGImage`로 디코딩한다.
///
/// AppKit 대신 ImageIO를 쓰는 이유는, SwiftXKit이 GUI 프레임워크에 묶이지 않게 하기 위해서다.
/// 클립보드 읽기처럼 AppKit이 꼭 필요한 코드는 해당 CLI 쪽에 둔다.
public func loadCGImage(data: Data) throws -> CGImage {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw ImageLoadingError.unreadable
    }
    return image
}

/// 이미지 파일을 `CGImage`로 디코딩한다.
public func loadCGImage(contentsOf url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw ImageLoadingError.unreadable
    }
    return image
}
