import Foundation
import Testing
@testable import ConsumerIOSShell

struct ConsumerAuthSessionManagerTests {
    @Test
    func signInThenRefreshUsesStoredRefreshToken() async throws {
        let recorder = AuthRecordingHTTPClient(
            responsesByPath: [
                "/app/v1/consumer/session/exchange": ("{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}", 200),
                "/app/v1/consumer/session/refresh": ("{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}", 200),
            ]
        )
        let client = ConsumerBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4101")!,
            httpClient: recorder
        )
        var manager = ConsumerAuthSessionManager(client: client)

        let signIn = try await manager.signIn(
            oidcToken: "dev:consumer-1:user@fleetfeast.dev:consumer",
            traceId: "trace-1",
            deviceId: "device-1"
        )
        let refresh = try await manager.refresh(
            traceId: "trace-2",
            deviceId: "device-1"
        )

        #expect(signIn.tokenPair.accessToken == "access-1")
        #expect(refresh.tokenPair.accessToken == "access-2")
        #expect(manager.currentSession()?.tokenPair.refreshToken == "refresh-2")
        #expect(recorder.paths == ["/app/v1/consumer/session/exchange", "/app/v1/consumer/session/refresh"])
        #expect(recorder.bodies[1].contains("\"refreshToken\":\"refresh-1\""))
    }

    @Test
    func refreshWithoutSignInThrows() async {
        let recorder = AuthRecordingHTTPClient(responsesByPath: [:])
        let client = ConsumerBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4101")!,
            httpClient: recorder
        )
        var manager = ConsumerAuthSessionManager(client: client)

        do {
            _ = try await manager.refresh(traceId: "trace-1", deviceId: "device-1")
            Issue.record("Expected missingSession error")
        } catch ConsumerAuthSessionManagerError.missingSession {
            // Expected path.
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }
}

private final class AuthRecordingHTTPClient: HTTPClient {
    private let responsesByPath: [String: (String, Int)]
    var paths: [String] = []
    var bodies: [String] = []

    init(responsesByPath: [String: (String, Int)]) {
        self.responsesByPath = responsesByPath
    }

    func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let url = try #require(request.url)
        paths.append(url.path)
        bodies.append(String(data: request.httpBody ?? Data(), encoding: .utf8) ?? "")

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
