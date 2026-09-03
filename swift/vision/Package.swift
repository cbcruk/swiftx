// swift-tools-version:5.9
import PackageDescription

// Vision의 VNRecognizeTextRequest만 쓰므로 macOS 13에 머문다.
// pdf-cli/translate-cli(macOS 26)와 같은 패키지에 넣지 않는 이유가 이것이다.
//
// 줄 병합 같은 순수 로직은 VisionOCRKit에 두고 실행 파일과 분리한다.
// 실행 파일 안에 두면 테스트할 수 없고, 실제로 그 자리에서 버그가 났다.
let package = Package(
    name: "swiftx-vision",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "VisionOCRKit", targets: ["VisionOCRKit"])
    ],
    dependencies: [
        .package(path: "../core")
    ],
    targets: [
        .target(
            name: "VisionOCRKit",
            dependencies: [
                .product(name: "SwiftXKit", package: "core")
            ],
            path: "Sources/VisionOCRKit"
        ),
        .executableTarget(
            name: "vision-ocr-cli",
            dependencies: [
                "VisionOCRKit",
                .product(name: "SwiftXKit", package: "core"),
            ],
            path: "Sources/vision-ocr-cli"
        ),
        .testTarget(
            name: "VisionOCRKitTests",
            dependencies: ["VisionOCRKit"],
            path: "Tests/VisionOCRKitTests"
        ),
    ]
)
