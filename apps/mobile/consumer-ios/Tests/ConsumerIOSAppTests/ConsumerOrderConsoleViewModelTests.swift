import Foundation
import Testing
@testable import ConsumerIOSApp

@MainActor
struct ConsumerOrderConsoleViewModelTests {
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
