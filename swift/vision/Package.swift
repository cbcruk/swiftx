// swift-tools-version:5.9
import PackageDescription

// Vision의 VNRecognizeTextRequest만 쓰므로 macOS 13에 머문다.
// pdf-cli/translate-cli(macOS 26)와 같은 패키지에 넣지 않는 이유가 이것이다.
let package = Package(
    name: "swiftx-vision",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(path: "../core")
    ],
    targets: [
        .executableTarget(
            name: "vision-ocr-cli",
            dependencies: [
                .product(name: "SwiftXKit", package: "core")
            ],
            path: "Sources/vision-ocr-cli"
        )
    ]
)
