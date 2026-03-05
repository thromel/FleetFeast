import ConsumerIOSShell
import Foundation

typealias ConsumerOrder = ConsumerIOSShell.ConsumerOrder

typealias ConsumerQuickOrderModifier = ConsumerIOSShell.ConsumerQuickOrderModifier

typealias ConsumerQuickOrderItem = ConsumerIOSShell.ConsumerQuickOrderItem

typealias AppSession = ConsumerIOSShell.AppSession

typealias AppSessionTokenPair = ConsumerIOSShell.AppSessionTokenPair

typealias SessionExchangeResponse = ConsumerIOSShell.SessionExchangeResponse

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

protocol ConsumerSessionClient: Sendable {
    func signIn(oidcToken: String) async throws -> SessionExchangeResponse
    func refreshSession() async throws -> SessionExchangeResponse
}

@MainActor
final class ConsumerOrderConsoleViewModel: ObservableObject {
    @Published var selectedPreset: ConsumerMenuPreset = .weeknightCrunch
    @Published var baseURLString = "http://127.0.0.1:4101"
    @Published var oidcToken = "dev:consumer-1:consumer-1@fleetfeast.dev:consumer"

    @Published var consumerId = "consumer-1"
    @Published var merchantId = "merchant-1"
    @Published var itemName = ConsumerMenuPreset.weeknightCrunch.itemName
    @Published var quantity = 1
    @Published var unitPriceCents = ConsumerMenuPreset.weeknightCrunch.unitPriceCents
    @Published var modifierName: String = ConsumerMenuPreset.weeknightCrunch.modifierName
    @Published var modifierPriceCents: Int = ConsumerMenuPreset.weeknightCrunch.modifierPriceCents

    @Published var isBusy = false
    @Published var lastError: String?
    @Published var order: ConsumerOrder?
    @Published var session: SessionExchangeResponse?

    private let client: ConsumerOrderingClient?
    private let sessionClient: ConsumerSessionClient?
    private var liveSessionClient: ConsumerSessionClient?

    init(
        client: ConsumerOrderingClient? = nil,
        sessionClient: ConsumerSessionClient? = nil
    ) {
        self.client = client
        self.sessionClient = sessionClient
        self.liveSessionClient = sessionClient
    }

    var draftTotalCents: Int {
        quantity * (unitPriceCents + max(modifierPriceCents, 0))
    }

    var stageDescriptor: ConsumerOrderStageDescriptor {
        ConsumerOrderStageDescriptor(status: order?.status)
    }

    func applyPreset(_ preset: ConsumerMenuPreset) {
        selectedPreset = preset
        itemName = preset.itemName
        unitPriceCents = preset.unitPriceCents
        modifierName = preset.modifierName
        modifierPriceCents = preset.modifierPriceCents
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

    func signIn() async {
        isBusy = true
        defer { isBusy = false }

        guard let sessionClient = resolveSessionClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            let signedInSession = try await sessionClient.signIn(oidcToken: oidcToken)
            session = signedInSession
            consumerId = signedInSession.session.userId
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    func refreshSession() async {
        isBusy = true
        defer { isBusy = false }

        guard let sessionClient = resolveSessionClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            let refreshedSession = try await sessionClient.refreshSession()
            session = refreshedSession
            consumerId = refreshedSession.session.userId
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    func runDemo() async {
        await signIn()
        guard session != nil else {
            return
        }

        await createOrder()
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

    private func resolveSessionClient() -> ConsumerSessionClient? {
        if let liveSessionClient {
            return liveSessionClient
        }

        guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        let sessionClient = ConsumerBackendSessionClient(baseURL: baseURL)
        liveSessionClient = sessionClient
        return sessionClient
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

private actor ConsumerBackendSessionClient: ConsumerSessionClient {
    private let baseURL: URL
    private var activeSession: SessionExchangeResponse?

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func signIn(oidcToken: String) async throws -> SessionExchangeResponse {
        let client = ConsumerBackendClient(baseURL: baseURL)
        let response = try await client.exchangeSession(
            oidcToken: oidcToken,
            traceId: "ios-consumer-signin-\(UUID().uuidString.lowercased())",
            deviceId: "consumer-ios-local"
        )
        activeSession = response
        return response
    }

    func refreshSession() async throws -> SessionExchangeResponse {
        guard let refreshToken = activeSession?.tokenPair.refreshToken else {
            throw ConsumerAuthSessionManagerError.missingSession
        }

        let client = ConsumerBackendClient(baseURL: baseURL)
        let response = try await client.refreshSession(
            refreshToken: refreshToken,
            traceId: "ios-consumer-refresh-\(UUID().uuidString.lowercased())",
            deviceId: "consumer-ios-local"
        )
        activeSession = response
        return response
    }
}
