import Foundation

struct CourierJobFocusDescriptor: Equatable, Sendable {
    let label: String
    let persona: String
    let progress: Double
    let headline: String
    let detail: String

    init(
        label: String,
        persona: String,
        progress: Double,
        headline: String,
        detail: String
    ) {
        self.label = label
        self.persona = persona
        self.progress = progress
        self.headline = headline
        self.detail = detail
    }

    init(status: String?) {
        switch status {
        case "AVAILABLE":
            self = .init(
                label: "Ready to Accept",
                persona: "Dispatch",
                progress: 0.28,
                headline: "A fresh job is waiting",
                detail: "Accept the job to claim the live handoff."
            )
        case "ASSIGNED", "ACCEPTED":
            self = .init(
                label: "Head to Pickup",
                persona: "Courier",
                progress: 0.55,
                headline: "Pickup is the next action",
                detail: "The job is active and ready for store arrival confirmation."
            )
        case "PICKED_UP":
            self = .init(
                label: "Complete Dropoff",
                persona: "Courier",
                progress: 0.82,
                headline: "Final mile is in progress",
                detail: "One more action completes the end-to-end delivery demo."
            )
        case "DELIVERED", "DROPPED_OFF":
            self = .init(
                label: "Completed",
                persona: "Consumer",
                progress: 1.0,
                headline: "The handoff is complete",
                detail: "The courier workflow has finished successfully."
            )
        default:
            self = .init(
                label: "Waiting for Work",
                persona: "Dispatch",
                progress: 0.1,
                headline: "No active courier job yet",
                detail: "Request dispatch from the merchant surface, then reload this board."
            )
        }
    }
}

func resolveCourierFocusJob(from jobs: [CourierJob]) -> CourierJob? {
    let priority: [String: Int] = [
        "PICKED_UP": 0,
        "ACCEPTED": 1,
        "ASSIGNED": 2,
        "AVAILABLE": 3,
        "DELIVERED": 4,
        "DROPPED_OFF": 4,
    ]

    return jobs.min {
        let left = priority[$0.status] ?? 5
        let right = priority[$1.status] ?? 5
        if left == right {
            return $0.jobId < $1.jobId
        }
        return left < right
    }
}
