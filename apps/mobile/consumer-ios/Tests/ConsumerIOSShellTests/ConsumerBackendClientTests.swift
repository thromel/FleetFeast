import Foundation
import Testing
@testable import ConsumerIOSShell

struct ConsumerBackendClientTests {
    @Test
    func fetchOrderCallsConsumerBffPath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/consumer/orders/order-7": ("{\"order\":{\"id\":\"order-7\",\"status\":\"COURIER_ASSIGNED\",\"timelineVersion\":4}}", 200)
            ]
        )
        let client = ConsumerBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4101")!,
            httpClient: recorder
        )

        let order = try await client.fetchOrder(orderId: "order-7")

        #expect(order.id == "order-7")
        #expect(order.status == "COURIER_ASSIGNED")
        #expect(order.timelineVersion == 4)
        #expect(recorder.lastPath == "/app/v1/consumer/orders/order-7")
    }

    @Test
    func fetchFeatureFlagsCallsConsumerFeatureFlagsPath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/consumer/feature-flags": ("{\"flags\":{\"consumer.timelineV2\":true},\"ttlSeconds\":30,\"generatedAtEpochMillis\":1735684000000}", 200)
            ]
        )
        let client = ConsumerBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4101")!,
            httpClient: recorder
        )

        let flags = try await client.fetchFeatureFlags(userId: "consumer-1", role: "consumer", tenantId: "metro-1")

        #expect(flags.flags["consumer.timelineV2"] == true)
        #expect(recorder.lastPath == "/app/v1/consumer/feature-flags")
        #expect(recorder.lastQuery?.contains("userId=consumer-1") == true)
        #expect(recorder.lastQuery?.contains("role=consumer") == true)
        #expect(recorder.lastQuery?.contains("tenantId=metro-1") == true)
    }
}

private final class RecordingHTTPClient: HTTPClient {
    private let responsesByPath: [String: (String, Int)]
    var lastPath: String?
    var lastQuery: String?

    init(responsesByPath: [String: (String, Int)]) {
        self.responsesByPath = responsesByPath
    }

    func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let url = try #require(request.url)
        lastPath = url.path
        lastQuery = url.query

        let responseConfig = responsesByPath[url.path] ?? ("{}", 404)
        let response = HTTPURLResponse(
            url: url,
            statusCode: responseConfig.1,
            httpVersion: nil,
            headerFields: ["content-type": "application/json"]
        )!

        return (Data(responseConfig.0.utf8), response)
    }
}
