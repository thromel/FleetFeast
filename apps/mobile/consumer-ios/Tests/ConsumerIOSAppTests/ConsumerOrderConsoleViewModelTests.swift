import Foundation
import Testing
@testable import ConsumerIOSApp

@MainActor
struct ConsumerOrderConsoleViewModelTests {
    @Test
    func signInStoresSessionAndHydratesConsumerId() async {
        let orderingClient = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )
        let sessionClient = FakeConsumerSessionClient(
            signInResult: .success(makeConsumerSessionResponse(userId: "consumer-42", accessToken: "access-1", refreshToken: "refresh-1")),
            refreshResult: .success(makeConsumerSessionResponse(userId: "consumer-42", accessToken: "access-2", refreshToken: "refresh-2"))
        )

        let model = ConsumerOrderConsoleViewModel(client: orderingClient, sessionClient: sessionClient)
        model.oidcToken = "dev:consumer-42:consumer-42@fleetfeast.dev:consumer"

        await model.signIn()

        #expect(model.lastError == nil)
        #expect(model.session?.session.userId == "consumer-42")
        #expect(model.consumerId == "consumer-42")
        #expect(await sessionClient.signInCallCount == 1)
    }

    @Test
    func refreshSessionUpdatesStoredTokenPair() async {
        let orderingClient = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )
        let sessionClient = FakeConsumerSessionClient(
            signInResult: .success(makeConsumerSessionResponse(userId: "consumer-42", accessToken: "access-1", refreshToken: "refresh-1")),
            refreshResult: .success(makeConsumerSessionResponse(userId: "consumer-42", accessToken: "access-2", refreshToken: "refresh-2"))
        )

        let model = ConsumerOrderConsoleViewModel(client: orderingClient, sessionClient: sessionClient)
        await model.signIn()

        await model.refreshSession()

        #expect(model.session?.tokenPair.accessToken == "access-2")
        #expect(await sessionClient.refreshCallCount == 1)
    }

    @Test
    func runDemoSignsInAndCreatesOrder() async {
        let orderingClient = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-7", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-7", status: "CREATED", timelineVersion: 0))
        )
        let sessionClient = FakeConsumerSessionClient(
            signInResult: .success(makeConsumerSessionResponse(userId: "consumer-demo", accessToken: "access-1", refreshToken: "refresh-1")),
            refreshResult: .success(makeConsumerSessionResponse(userId: "consumer-demo", accessToken: "access-2", refreshToken: "refresh-2"))
        )

        let model = ConsumerOrderConsoleViewModel(client: orderingClient, sessionClient: sessionClient)
        model.itemName = "Smash Burger"
        model.unitPriceCents = 1599

        await model.runDemo()

        #expect(model.session?.session.userId == "consumer-demo")
        #expect(model.consumerId == "consumer-demo")
        #expect(model.order?.id == "order-7")
        #expect(await sessionClient.signInCallCount == 1)
        #expect(await orderingClient.createCallCount == 1)
    }

    @Test
    func applyPresetHydratesDraftAndUpdatesTotal() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)
        model.quantity = 2

        model.applyPreset(.familySizzle)

        #expect(model.itemName == "Family Sizzle Box")
        #expect(model.unitPriceCents == 1895)
        #expect(model.modifierName == "Calamansi Slaw")
        #expect(model.modifierPriceCents == 145)
        #expect(model.draftTotalCents == 4_080)
    }

    @Test
    func orderStageReflectsBackendStatusForTimelineUi() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)

        #expect(model.stageDescriptor.label == "Ready to Order")
        #expect(model.stageDescriptor.progress == 0.12)

        model.order = .init(id: "order-1", status: "DISPATCH_PENDING", timelineVersion: 2)
        #expect(model.stageDescriptor.label == "Dispatching")
        #expect(model.stageDescriptor.persona == "Ops")

        model.order = .init(id: "order-1", status: "DELIVERED", timelineVersion: 5)
        #expect(model.stageDescriptor.label == "Delivered")
        #expect(model.stageDescriptor.progress == 1.0)
    }

    @Test
    func createOrderSuccessStoresOrderAndClearsError() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)
        model.consumerId = "consumer-1"
        model.merchantId = "merchant-1"
        model.itemName = "Chicken Rice"
        model.quantity = 1
        model.unitPriceCents = 1250

        await model.createOrder()

        #expect(model.lastError == nil)
        #expect(model.order?.id == "order-1")
        #expect(model.order?.status == "CREATED")
        #expect(await client.createCallCount == 1)
    }

    @Test
    func createOrderFailureStoresError() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .failure(FakeConsumerOrderingClientError.stub),
            fetchOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)
        model.consumerId = "consumer-1"
        model.merchantId = "merchant-1"
        model.itemName = "Chicken Rice"
        model.quantity = 1
        model.unitPriceCents = 1250

        await model.createOrder()

        #expect(model.order == nil)
        #expect(model.lastError != nil)
        #expect(await client.createCallCount == 1)
    }

    @Test
    func refreshOrderWithoutOrderDoesNotCallBackend() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "DELIVERED", timelineVersion: 2))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)

        await model.refreshOrder()

        #expect(await client.fetchCallCount == 0)
        #expect(model.order == nil)
    }

    @Test
    func refreshOrderUpdatesStatus() async {
        let client = FakeConsumerOrderingClient(
            createOrderResult: .success(.init(id: "order-1", status: "CREATED", timelineVersion: 0)),
            fetchOrderResult: .success(.init(id: "order-1", status: "DELIVERED", timelineVersion: 3))
        )

        let model = ConsumerOrderConsoleViewModel(client: client)
        model.order = .init(id: "order-1", status: "CREATED", timelineVersion: 0)

        await model.refreshOrder()

        #expect(model.order?.status == "DELIVERED")
        #expect(await client.fetchCallCount == 1)
    }
}

enum FakeConsumerOrderingClientError: Error {
    case stub
}

actor FakeConsumerSessionClient: ConsumerSessionClient {
    private let signInResult: Result<SessionExchangeResponse, Error>
    private let refreshResult: Result<SessionExchangeResponse, Error>

    private(set) var signInCallCount = 0
    private(set) var refreshCallCount = 0

    init(signInResult: Result<SessionExchangeResponse, Error>, refreshResult: Result<SessionExchangeResponse, Error>) {
        self.signInResult = signInResult
        self.refreshResult = refreshResult
    }

    func signIn(oidcToken: String) async throws -> SessionExchangeResponse {
        signInCallCount += 1
        return try signInResult.get()
    }

    func refreshSession() async throws -> SessionExchangeResponse {
        refreshCallCount += 1
        return try refreshResult.get()
    }
}

actor FakeConsumerOrderingClient: ConsumerOrderingClient {
    private let createOrderResult: Result<ConsumerOrder, Error>
    private let fetchOrderResult: Result<ConsumerOrder, Error>

    private(set) var createCallCount = 0
    private(set) var fetchCallCount = 0

    init(createOrderResult: Result<ConsumerOrder, Error>, fetchOrderResult: Result<ConsumerOrder, Error>) {
        self.createOrderResult = createOrderResult
        self.fetchOrderResult = fetchOrderResult
    }

    func createQuickOrder(input: ConsumerQuickCreateOrderInput) async throws -> ConsumerOrder {
        createCallCount += 1
        return try createOrderResult.get()
    }

    func fetchOrder(orderId: String) async throws -> ConsumerOrder {
        fetchCallCount += 1
        return try fetchOrderResult.get()
    }
}

private func makeConsumerSessionResponse(
    userId: String,
    accessToken: String,
    refreshToken: String
) -> SessionExchangeResponse {
    SessionExchangeResponse(
        session: AppSession(
            sessionId: "session-\(accessToken)",
            userId: userId,
            role: "consumer",
            persona: "consumer",
            traceId: "trace-\(accessToken)",
            refreshTokenId: "rt-\(refreshToken)",
            issuedAt: "2026-02-19T00:00:00Z",
            expiresAt: "2026-02-19T01:00:00Z"
        ),
        tokenPair: AppSessionTokenPair(
            tokenType: "Bearer",
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresInSeconds: 3600,
            refreshExpiresInSeconds: 2_592_000,
            refreshExpiresAt: "2026-03-21T00:00:00Z"
        )
    )
}
