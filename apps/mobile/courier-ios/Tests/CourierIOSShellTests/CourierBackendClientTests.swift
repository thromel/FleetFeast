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
