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
        ),
        .executable(
            name: "CourierIOSApp",
            targets: ["CourierIOSApp"]
        ),
    ],
    targets: [
        .target(
            name: "CourierIOSShell"
        ),
        .executableTarget(
            name: "CourierIOSApp",
            dependencies: ["CourierIOSShell"]
        ),
        .testTarget(
            name: "CourierIOSShellTests",
            dependencies: ["CourierIOSShell"]
        ),
        .testTarget(
            name: "CourierIOSAppTests",
            dependencies: ["CourierIOSApp"]
        )
    ]
)
