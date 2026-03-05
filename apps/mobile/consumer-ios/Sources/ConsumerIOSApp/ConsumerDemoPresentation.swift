import Foundation

enum ConsumerMenuPreset: String, CaseIterable, Identifiable, Sendable {
    case weeknightCrunch
    case familySizzle
    case midnightHeat

    var id: String { rawValue }

    var badge: String {
        switch self {
        case .weeknightCrunch:
            return "Best Seller"
        case .familySizzle:
            return "Share Plate"
        case .midnightHeat:
            return "Late Night"
        }
    }

    var title: String {
        switch self {
        case .weeknightCrunch:
            return "Weeknight Crunch Bowl"
        case .familySizzle:
            return "Family Sizzle Box"
        case .midnightHeat:
            return "Midnight Heat Wrap"
        }
    }

    var subtitle: String {
        switch self {
        case .weeknightCrunch:
            return "Ginger rice, citrus chicken, bright herb finish."
        case .familySizzle:
            return "Smoky grilled feast built for a quick group order."
        case .midnightHeat:
            return "A richer, hotter pick for the late rush."
        }
    }

    var symbolName: String {
        switch self {
        case .weeknightCrunch:
            return "leaf.circle.fill"
        case .familySizzle:
            return "takeoutbag.and.cup.and.straw.fill"
        case .midnightHeat:
            return "moon.stars.fill"
        }
    }

    var itemName: String {
        title
    }

    var unitPriceCents: Int {
        switch self {
        case .weeknightCrunch:
            return 1_250
        case .familySizzle:
            return 1_895
        case .midnightHeat:
            return 1_675
        }
    }

    var modifierName: String {
        switch self {
        case .weeknightCrunch:
            return "Extra Sauce"
        case .familySizzle:
            return "Calamansi Slaw"
        case .midnightHeat:
            return "Fire Mayo"
        }
    }

    var modifierPriceCents: Int {
        switch self {
        case .weeknightCrunch:
            return 100
        case .familySizzle:
            return 145
        case .midnightHeat:
            return 125
        }
    }
}

struct ConsumerOrderStageDescriptor: Equatable, Sendable {
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
        case "CREATED", "MERCHANT_ACCEPTED":
            self = .init(
                label: "Merchant Confirming",
                persona: "Merchant",
                progress: 0.32,
                headline: "Kitchen check in progress",
                detail: "The merchant has the basket and is preparing the handoff."
            )
        case "DISPATCH_PENDING", "DISPATCH_REQUESTED":
            self = .init(
                label: "Dispatching",
                persona: "Ops",
                progress: 0.56,
                headline: "Courier is being assigned",
                detail: "Dispatch is selecting the best rider for this order."
            )
        case "COURIER_ASSIGNED", "ASSIGNED", "ACCEPTED":
            self = .init(
                label: "Courier Locked",
                persona: "Courier",
                progress: 0.74,
                headline: "A rider is heading to pickup",
                detail: "Use the courier app to continue the live handoff."
            )
        case "PICKED_UP":
            self = .init(
                label: "On The Way",
                persona: "Courier",
                progress: 0.9,
                headline: "The order is heading to the door",
                detail: "Dropoff is the last step before delivery completes."
            )
        case "DELIVERED", "DROPPED_OFF":
            self = .init(
                label: "Delivered",
                persona: "Consumer",
                progress: 1.0,
                headline: "Demo journey completed",
                detail: "The order has cleared the full client walkthrough."
            )
        default:
            self = .init(
                label: "Ready to Order",
                persona: "Consumer",
                progress: 0.12,
                headline: "Create the basket to begin",
                detail: "The native consumer app can create a live order through consumer-bff."
            )
        }
    }
}

func formatCurrency(cents: Int) -> String {
    let dollars = Double(cents) / 100
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.maximumFractionDigits = 2
    formatter.minimumFractionDigits = 2
    return formatter.string(from: NSNumber(value: dollars)) ?? String(format: "$%.2f", dollars)
}
