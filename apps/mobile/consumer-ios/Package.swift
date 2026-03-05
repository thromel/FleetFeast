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
        ),
        .executable(
            name: "ConsumerIOSApp",
            targets: ["ConsumerIOSApp"]
        ),
    ],
    targets: [
        .target(
            name: "ConsumerIOSShell"
        ),
        .executableTarget(
            name: "ConsumerIOSApp",
            dependencies: ["ConsumerIOSShell"]
        ),
        .testTarget(
            name: "ConsumerIOSShellTests",
            dependencies: ["ConsumerIOSShell"]
        ),
        .testTarget(
            name: "ConsumerIOSAppTests",
            dependencies: ["ConsumerIOSApp"]
        )
    ]
)
