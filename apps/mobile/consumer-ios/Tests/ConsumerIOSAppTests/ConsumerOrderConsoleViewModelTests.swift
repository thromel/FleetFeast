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
