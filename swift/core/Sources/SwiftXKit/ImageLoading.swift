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

/// 알파 채널을 단색 배경 위로 합성한 이미지를 돌려준다. 알파가 없으면 원본 그대로다.
///
/// Vision은 투명 배경 위의 글자를 거의 인식하지 못한다. PDF에서 내보낸 PNG나 투명
/// 스크린샷이 흔히 이 경우인데, 오류가 아니라 "인식 결과 없음"으로 나와 원인을 찾기가
/// 어렵다. 그래서 인식 전에 배경을 깔아준다.
///
/// 기본값은 흰 배경이다. 투명 배경에 **흰 글자**를 담은 이미지라면 이 합성이 글자를
/// 지우므로, 그런 입력은 `background`를 낮춰 부른다.
///
/// - Note: 합성에 실패하면 원본을 그대로 돌려준다. 여기서 실패시키는 것보다
///   인식을 시도해 보는 편이 낫다.
public func flattenTransparency(_ image: CGImage, background: CGFloat = 1) -> CGImage {
    switch image.alphaInfo {
    case .none, .noneSkipFirst, .noneSkipLast:
        return image
    default:
        break
    }

    let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
        let context = CGContext(
            data: nil,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )
    else {
        return image
    }

    context.setFillColor(gray: background, alpha: 1)
    context.fill(rect)
    context.draw(image, in: rect)

    return context.makeImage() ?? image
}
