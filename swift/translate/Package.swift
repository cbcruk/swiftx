// swift-tools-version:6.0
import PackageDescription

// translate-cli는 TranslationSession(installedSource:target:)를 쓰므로 macOS 26을 요구한다.
let package = Package(
    name: "swiftx-translate",
    platforms: [
        .macOS("26.0")
    ],
    dependencies: [
        .package(path: "../core")
    ],
    targets: [
        .executableTarget(
            name: "translate-cli",
            dependencies: [
                .product(name: "SwiftXKit", package: "core")
            ],
            path: "Sources/translate-cli"
        )
    ]
)
