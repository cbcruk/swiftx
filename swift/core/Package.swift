// swift-tools-version:5.9
import PackageDescription

// SwiftXKit은 모든 swiftx CLI가 공유하는 규약 레이어다.
// macOS 13을 하한으로 두어, 상위 하한을 요구하는 CLI(pdf-cli, translate-cli: macOS 26)와
// 낮은 하한을 유지해야 하는 CLI(vision-ocr-cli: macOS 13)가 같은 코어를 쓸 수 있게 한다.
let package = Package(
    name: "swiftx-core",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "SwiftXKit", targets: ["SwiftXKit"])
    ],
    targets: [
        .target(
            name: "SwiftXKit",
            path: "Sources/SwiftXKit"
        )
    ]
)
