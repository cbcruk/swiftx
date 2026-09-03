// swift-tools-version:6.0
import PackageDescription

// pdf-cli는 RecognizeDocumentsRequest를 쓰므로 macOS 26을 요구한다.
// 공용 코드(SwiftXKit)는 하한이 낮은 별도 패키지에 있어 여기서 path로 가져온다.
let package = Package(
    name: "swiftx-pdf",
    platforms: [
        .macOS("26.0")
    ],
    dependencies: [
        .package(path: "../core")
    ],
    targets: [
        .executableTarget(
            name: "pdf-cli",
            dependencies: [
                .product(name: "SwiftXKit", package: "swiftx-core")
            ],
            path: "Sources/pdf-cli"
        )
    ]
)
