import Foundation
import Testing
@testable import ConsumerIOSShell

struct ConsumerAppShellTests {
    @Test
    func startupSummaryUsesConfiguredUrl() throws {
        let config = try ConsumerAppShellConfig(bffBaseURLString: "http://127.0.0.1:4101")
        let shell = ConsumerAppShell(config: config)

        #expect(shell.startupSummary() == "Consumer iOS shell configured for http://127.0.0.1:4101")
        #expect(shell.orderPath(orderId: "order-1") == "/app/v1/consumer/orders/order-1")
    }

    @Test
    func featureFlagPathIncludesContextQuery() throws {
        let config = try ConsumerAppShellConfig(bffBaseURLString: "http://127.0.0.1:4101")
        let shell = ConsumerAppShell(config: config)

        let path = shell.featureFlagPath(userId: "consumer-1", role: "consumer", tenantId: "metro-1")

        #expect(path.contains("/app/v1/consumer/feature-flags?"))
        #expect(path.contains("userId=consumer-1"))
        #expect(path.contains("role=consumer"))
        #expect(path.contains("tenantId=metro-1"))
    }

    @Test
    func invalidUrlThrows() {
        #expect(throws: ConsumerShellConfigError.self) {
            _ = try ConsumerAppShellConfig(bffBaseURLString: "not-a-url")
        }
    }

    @Test
    func shellCreatesAuthSessionManagerUsingConfiguredBaseURL() async throws {
        let config = try ConsumerAppShellConfig(bffBaseURLString: "http://127.0.0.1:4101")
        let shell = ConsumerAppShell(config: config)
        let recorder = ShellRecordingHTTPClient(
            responsesByPath: [
                "/app/v1/consumer/session/exchange": ("{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}", 200),
            ]
        )

        var manager = shell.makeAuthSessionManager(httpClient: recorder)
        let response = try await manager.signIn(
            oidcToken: "dev:consumer-1:user@fleetfeast.dev:consumer",
            traceId: "trace-1",
            deviceId: "device-1"
        )

        #expect(response.session.persona == "consumer")
        #expect(recorder.lastPath == "/app/v1/consumer/session/exchange")
    }
}

private final class ShellRecordingHTTPClient: HTTPClient {
    private let responsesByPath: [String: (String, Int)]
    var lastPath: String?

    init(responsesByPath: [String: (String, Int)]) {
        self.responsesByPath = responsesByPath
    }

    func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let url = try #require(request.url)
        lastPath = url.path

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
