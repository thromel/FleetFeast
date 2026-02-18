import Foundation

struct ConsumerAppShell {
    let bffBaseUrl: String

    func startupSummary() -> String {
        return "Consumer iOS shell configured for \(bffBaseUrl)"
    }
}
