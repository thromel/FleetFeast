import Foundation
import Testing
@testable import CourierIOSShell

struct CourierBackendClientTests {
    @Test
    func fetchAvailableJobsCallsCourierJobsPath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/jobs/available": ("{\"jobs\":[{\"jobId\":\"job-1\",\"orderId\":\"order-1\",\"status\":\"AVAILABLE\"}]}", 200)
            ]
        )
        let client = CourierBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4102")!,
            httpClient: recorder
        )

        let jobs = try await client.fetchAvailableJobs()

        #expect(jobs.count == 1)
        #expect(jobs.first?.jobId == "job-1")
        #expect(recorder.lastPath == "/app/v1/courier/jobs/available")
    }

    @Test
    func fetchFeatureFlagsCallsCourierFeatureFlagsPath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/feature-flags": ("{\"flags\":{\"courier.offlineReplay\":true},\"ttlSeconds\":30,\"generatedAtEpochMillis\":1735684000000}", 200)
            ]
        )
        let client = CourierBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4102")!,
            httpClient: recorder
        )

        let flags = try await client.fetchFeatureFlags(userId: "courier-1", role: "courier", tenantId: "metro-1")

        #expect(flags.flags["courier.offlineReplay"] == true)
        #expect(recorder.lastPath == "/app/v1/courier/feature-flags")
        #expect(recorder.lastQuery?.contains("userId=courier-1") == true)
        #expect(recorder.lastQuery?.contains("role=courier") == true)
        #expect(recorder.lastQuery?.contains("tenantId=metro-1") == true)
    }

    @Test
    func jobActionsPostToCourierJobActionPaths() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/jobs/job-1/accept": ("{\"job\":{\"jobId\":\"job-1\",\"orderId\":\"job-1\",\"status\":\"ACCEPTED\",\"courierId\":\"courier-1\"}}", 200),
                "/app/v1/courier/jobs/job-1/pickup": ("{\"job\":{\"jobId\":\"job-1\",\"orderId\":\"job-1\",\"status\":\"PICKED_UP\",\"courierId\":\"courier-1\"}}", 200),
                "/app/v1/courier/jobs/job-1/dropoff": ("{\"job\":{\"jobId\":\"job-1\",\"orderId\":\"job-1\",\"status\":\"DROPPED_OFF\",\"courierId\":\"courier-1\"}}", 200),
            ]
        )
        let client = CourierBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4102")!,
            httpClient: recorder
        )

        let accepted = try await client.acceptJob(jobId: "job-1", courierId: "courier-1")
        #expect(accepted.status == "ACCEPTED")
        #expect(recorder.lastPath == "/app/v1/courier/jobs/job-1/accept")
        #expect(recorder.lastMethod == "POST")

        let pickedUp = try await client.pickupJob(jobId: "job-1", courierId: "courier-1")
        #expect(pickedUp.status == "PICKED_UP")
        #expect(recorder.lastPath == "/app/v1/courier/jobs/job-1/pickup")

        let droppedOff = try await client.dropoffJob(jobId: "job-1", courierId: "courier-1")
        #expect(droppedOff.status == "DROPPED_OFF")
        #expect(recorder.lastPath == "/app/v1/courier/jobs/job-1/dropoff")
    }

    @Test
    func exchangeSessionPostsToSessionExchangePath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/session/exchange": ("{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}", 200)
            ]
        )
        let client = CourierBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4102")!,
            httpClient: recorder
        )

        let response = try await client.exchangeSession(
            oidcToken: "dev:courier-1:courier@fleetfeast.dev:courier",
            traceId: "trace-1",
            deviceId: "device-1"
        )

        #expect(response.session.persona == "courier")
        #expect(response.tokenPair.accessToken == "access-1")
        #expect(recorder.lastPath == "/app/v1/courier/session/exchange")
        #expect(recorder.lastMethod == "POST")
        #expect(recorder.lastBody?.contains("\"oidcToken\":\"dev:courier-1:courier@fleetfeast.dev:courier\"") == true)
    }

    @Test
    func refreshSessionPostsToSessionRefreshPath() async throws {
        let recorder = RecordingHTTPClient(
            responsesByPath: [
                "/app/v1/courier/session/refresh": ("{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}", 200)
            ]
        )
        let client = CourierBackendClient(
            baseURL: URL(string: "http://127.0.0.1:4102")!,
            httpClient: recorder
        )

        let response = try await client.refreshSession(
            refreshToken: "refresh-1",
            traceId: "trace-2",
            deviceId: "device-1"
        )

        #expect(response.session.traceId == "trace-2")
        #expect(response.tokenPair.accessToken == "access-2")
        #expect(recorder.lastPath == "/app/v1/courier/session/refresh")
        #expect(recorder.lastMethod == "POST")
        #expect(recorder.lastBody?.contains("\"refreshToken\":\"refresh-1\"") == true)
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
