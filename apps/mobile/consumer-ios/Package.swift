// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ConsumerIOSShell",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "ConsumerIOSShell",
            targets: ["ConsumerIOSShell"]
        )
    ],
    targets: [
        .target(
            name: "ConsumerIOSShell"
        ),
        .testTarget(
            name: "ConsumerIOSShellTests",
            dependencies: ["ConsumerIOSShell"]
        )
    ]
)
