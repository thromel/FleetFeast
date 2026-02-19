// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CourierIOSShell",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "CourierIOSShell",
            targets: ["CourierIOSShell"]
        )
    ],
    targets: [
        .target(
            name: "CourierIOSShell"
        ),
        .testTarget(
            name: "CourierIOSShellTests",
            dependencies: ["CourierIOSShell"]
        )
    ]
)
