import ConsumerIOSShell
import Foundation

typealias ConsumerOrder = ConsumerIOSShell.ConsumerOrder

typealias ConsumerQuickOrderModifier = ConsumerIOSShell.ConsumerQuickOrderModifier

typealias ConsumerQuickOrderItem = ConsumerIOSShell.ConsumerQuickOrderItem

struct ConsumerQuickCreateOrderInput: Sendable {
    let consumerId: String
    let merchantId: String
    let currency: String
    let itemName: String
    let quantity: Int
    let unitPriceCents: Int
    let modifierName: String?
    let modifierPriceCents: Int?

    init(
        consumerId: String,
        merchantId: String,
        currency: String,
        itemName: String,
        quantity: Int,
        unitPriceCents: Int,
        modifierName: String? = nil,
        modifierPriceCents: Int? = nil
    ) {
        self.consumerId = consumerId
        self.merchantId = merchantId
        self.currency = currency
        self.itemName = itemName
        self.quantity = quantity
        self.unitPriceCents = unitPriceCents
        self.modifierName = modifierName
        self.modifierPriceCents = modifierPriceCents
    }
}

protocol ConsumerOrderingClient: Sendable {
    func createQuickOrder(input: ConsumerQuickCreateOrderInput) async throws -> ConsumerOrder
    func fetchOrder(orderId: String) async throws -> ConsumerOrder
}

@MainActor
final class ConsumerOrderConsoleViewModel: ObservableObject {
    @Published var baseURLString = "http://127.0.0.1:4101"

    @Published var consumerId = "consumer-1"
    @Published var merchantId = "merchant-1"
    @Published var itemName = "Chicken Rice"
    @Published var quantity = 1
    @Published var unitPriceCents = 1250
    @Published var modifierName: String = ""
    @Published var modifierPriceCents: Int = 0

    @Published var isBusy = false
    @Published var lastError: String?
    @Published var order: ConsumerOrder?

    private let client: ConsumerOrderingClient?

    init(client: ConsumerOrderingClient? = nil) {
        self.client = client
    }

    func createOrder() async {
        isBusy = true
        defer { isBusy = false }

        guard let backendClient = resolveClient() else {
            lastError = "Invalid base URL"
            return
        }

        let input = ConsumerQuickCreateOrderInput(
            consumerId: consumerId,
            merchantId: merchantId,
            currency: "USD",
            itemName: itemName,
            quantity: quantity,
            unitPriceCents: unitPriceCents,
            modifierName: modifierName.isEmpty ? nil : modifierName,
            modifierPriceCents: modifierPriceCents > 0 ? modifierPriceCents : nil
        )

        do {
            order = try await backendClient.createQuickOrder(input: input)
            lastError = nil
        } catch {
            order = nil
            lastError = String(describing: error)
        }
    }

    func refreshOrder() async {
        guard let existing = order else {
            return
        }

        isBusy = true
        defer { isBusy = false }

        guard let backendClient = resolveClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            order = try await backendClient.fetchOrder(orderId: existing.id)
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    private func resolveClient() -> ConsumerOrderingClient? {
        if let client {
            return client
        }

        guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        return ConsumerBackendOrderingClient(baseURL: baseURL)
    }
}

private struct ConsumerBackendOrderingClient: ConsumerOrderingClient {
    let baseURL: URL

    func createQuickOrder(input: ConsumerQuickCreateOrderInput) async throws -> ConsumerOrder {
        let client = ConsumerBackendClient(baseURL: baseURL)

        let modifiers: [ConsumerQuickOrderModifier]
        if let modifierName = input.modifierName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !modifierName.isEmpty,
           let modifierPriceCents = input.modifierPriceCents,
           modifierPriceCents > 0 {
            modifiers = [ConsumerQuickOrderModifier(name: modifierName, priceCents: modifierPriceCents)]
        } else {
            modifiers = []
        }

        let item = ConsumerQuickOrderItem(
            itemId: "menu-item-1",
            name: input.itemName,
            quantity: input.quantity,
            unitPriceCents: input.unitPriceCents,
            modifiers: modifiers
        )

        return try await client.createQuickOrder(
            consumerId: input.consumerId,
            merchantId: input.merchantId,
            currency: input.currency,
            item: item
        )
    }

    func fetchOrder(orderId: String) async throws -> ConsumerOrder {
        let client = ConsumerBackendClient(baseURL: baseURL)
        return try await client.fetchOrder(orderId: orderId)
    }
}
