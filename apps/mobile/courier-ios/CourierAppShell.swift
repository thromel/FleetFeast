import Foundation

struct CourierAppShell {
    let bffBaseUrl: String
    let realtimeBaseUrl: String

    func startupSummary() -> String {
        return "Courier iOS shell configured for \(bffBaseUrl) with realtime \(realtimeBaseUrl)"
    }
}
