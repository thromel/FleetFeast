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

    @Test
    func exchangeSessionPostsToSessionExchangePath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/consumer/session/exchange": ("{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}", 200)
            ]
        )
        let client = ConsumerBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4101")!,
            httpClient: recorder
        )

        let response = try await client.exchangeSession(
            oidcToken: "dev:consumer-1:user@fleetfeast.dev:consumer",
            traceId: "trace-1",
            deviceId: "device-1"
        )

        #expect(response.session.persona == "consumer")
        #expect(response.tokenPair.accessToken == "access-1")
        #expect(recorder.lastPath == "/app/v1/consumer/session/exchange")
        #expect(recorder.lastMethod == "POST")
        #expect(recorder.lastBody?.contains("\"oidcToken\":\"dev:consumer-1:user@fleetfeast.dev:consumer\"") == true)
    }
}

private final class RecordingHTTPClient: HTTPClient {
    private let responsesByPath: [String: (String, Int)]
    var lastPath: String?
    var lastQuery: String?
    var lastMethod: String?
    var lastBody: String?

    init(responsesByPath: [String: (String, Int)]) {
        self.responsesByPath = responsesByPath
    }

    func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let url = try #require(request.url)
        lastPath = url.path
        lastQuery = url.query
        lastMethod = request.httpMethod
        if let body = request.httpBody {
            lastBody = String(data: body, encoding: .utf8)
        } else {
            lastBody = nil
        }

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
