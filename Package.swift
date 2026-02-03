// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "VisionOCR",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "VisionOCR", type: .dynamic, targets: ["VisionOCR"])
    ],
    dependencies: [
        .package(path: "../node_modules/node-swift")
    ],
    targets: [
        .target(
            name: "VisionOCR",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
            ],
            swiftSettings: [.interoperabilityMode(.Cxx)]
        )
    ]
)
