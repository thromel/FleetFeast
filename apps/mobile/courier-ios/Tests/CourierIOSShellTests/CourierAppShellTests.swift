import Foundation
import Testing
@testable import CourierIOSShell

struct CourierAppShellTests {
    @Test
    func startupSummaryUsesConfiguredUrls() throws {
        let config = try CourierAppShellConfig(
            bffBaseURLString: "http://127.0.0.1:4102",
            realtimeBaseURLString: "http://127.0.0.1:4104"
        )
        let shell = CourierAppShell(config: config)

        #expect(shell.startupSummary() == "Courier iOS shell configured for http://127.0.0.1:4102 with realtime http://127.0.0.1:4104")
        #expect(shell.availableJobsPath() == "/app/v1/courier/jobs/available")
        #expect(shell.realtimeConnectPath() == "/app/v1/realtime/connect")
    }

    @Test
    func featureFlagPathIncludesContextQuery() throws {
        let config = try CourierAppShellConfig(
            bffBaseURLString: "http://127.0.0.1:4102",
            realtimeBaseURLString: "http://127.0.0.1:4104"
        )
        let shell = CourierAppShell(config: config)

        let path = shell.featureFlagPath(userId: "courier-1", role: "courier", tenantId: "metro-1")

        #expect(path.contains("/app/v1/courier/feature-flags?"))
        #expect(path.contains("userId=courier-1"))
        #expect(path.contains("role=courier"))
        #expect(path.contains("tenantId=metro-1"))
    }

    @Test
    func invalidUrlThrows() {
        #expect(throws: CourierShellConfigError.self) {
            _ = try CourierAppShellConfig(
                bffBaseURLString: "not-a-url",
                realtimeBaseURLString: "http://127.0.0.1:4104"
            )
        }
    }

    @Test
    func shellCreatesAuthSessionManagerUsingConfiguredBaseURL() async throws {
        let config = try CourierAppShellConfig(
            bffBaseURLString: "http://127.0.0.1:4102",
            realtimeBaseURLString: "http://127.0.0.1:4104"
        )
        let shell = CourierAppShell(config: config)
        let recorder = ShellRecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/session/exchange": ("{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}", 200),
            ]
        )

        var manager = shell.makeAuthSessionManager(httpClient: recorder)
        let response = try await manager.signIn(
            oidcToken: "dev:courier-1:courier@fleetfeast.dev:courier",
            traceId: "trace-1",
            deviceId: "device-1"
        )

        #expect(response.session.persona == "courier")
        #expect(recorder.lastPath == "/app/v1/courier/session/exchange")
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
