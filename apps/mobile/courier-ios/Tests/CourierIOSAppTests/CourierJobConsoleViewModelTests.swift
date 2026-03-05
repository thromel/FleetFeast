import Foundation
import Testing
@testable import CourierIOSApp

@MainActor
struct CourierJobConsoleViewModelTests {
    @Test
    func signInStoresSessionAndHydratesCourierId() async {
        let jobsClient = FakeCourierJobsClient(
            loadJobsResult: .success([]),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-42")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-42")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-42"))
        )
        let sessionClient = FakeCourierSessionClient(
            signInResult: .success(makeCourierSessionResponse(userId: "courier-42", accessToken: "access-1", refreshToken: "refresh-1")),
            refreshResult: .success(makeCourierSessionResponse(userId: "courier-42", accessToken: "access-2", refreshToken: "refresh-2"))
        )

        let model = CourierJobConsoleViewModel(client: jobsClient, sessionClient: sessionClient)
        model.oidcToken = "dev:courier-42:courier-42@fleetfeast.dev:courier"

        await model.signIn()

        #expect(model.lastError == nil)
        #expect(model.session?.session.userId == "courier-42")
        #expect(model.courierId == "courier-42")
        #expect(await sessionClient.signInCallCount == 1)
    }

    @Test
    func refreshSessionUpdatesStoredTokenPair() async {
        let jobsClient = FakeCourierJobsClient(
            loadJobsResult: .success([]),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-42")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-42")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-42"))
        )
        let sessionClient = FakeCourierSessionClient(
            signInResult: .success(makeCourierSessionResponse(userId: "courier-42", accessToken: "access-1", refreshToken: "refresh-1")),
            refreshResult: .success(makeCourierSessionResponse(userId: "courier-42", accessToken: "access-2", refreshToken: "refresh-2"))
        )

        let model = CourierJobConsoleViewModel(client: jobsClient, sessionClient: sessionClient)
        await model.signIn()

        await model.refreshSession()

        #expect(model.session?.tokenPair.accessToken == "access-2")
        #expect(await sessionClient.refreshCallCount == 1)
    }

    @Test
    func loadJobsSuccessStoresJobsAndClearsError() async {
        let client = FakeCourierJobsClient(
            loadJobsResult: .success([
                .init(jobId: "job-1", orderId: "order-1", status: "AVAILABLE", courierId: nil),
                .init(jobId: "job-2", orderId: "order-2", status: "ASSIGNED", courierId: "courier-1"),
            ]),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-1")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-1"))
        )

        let model = CourierJobConsoleViewModel(client: client)
        model.courierId = "courier-1"

        await model.loadJobs()

        #expect(model.lastError == nil)
        #expect(model.jobs.count == 2)
        #expect(model.jobs.first?.jobId == "job-1")
        #expect(await client.loadCallCount == 1)
    }

    @Test
    func loadJobsFailureStoresError() async {
        let client = FakeCourierJobsClient(
            loadJobsResult: .failure(FakeCourierJobsClientError.stub),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-1")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-1"))
        )

        let model = CourierJobConsoleViewModel(client: client)

        await model.loadJobs()

        #expect(model.jobs.isEmpty)
        #expect(model.lastError != nil)
        #expect(await client.loadCallCount == 1)
    }

    @Test
    func acceptJobUpdatesMatchingJobStatus() async {
        let client = FakeCourierJobsClient(
            loadJobsResult: .success([
                .init(jobId: "job-1", orderId: "order-1", status: "AVAILABLE", courierId: nil),
            ]),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-1")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-1"))
        )

        let model = CourierJobConsoleViewModel(client: client)
        model.courierId = "courier-1"
        model.jobs = [
            .init(jobId: "job-1", orderId: "order-1", status: "AVAILABLE", courierId: nil),
        ]

        await model.accept(jobId: "job-1")

        #expect(model.jobs.first?.status == "ACCEPTED")
        #expect(model.jobs.first?.courierId == "courier-1")
        #expect(await client.acceptCallCount == 1)
    }

    @Test
    func pickupAndDropoffUpdateMatchingJobStatus() async {
        let client = FakeCourierJobsClient(
            loadJobsResult: .success([
                .init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1"),
            ]),
            acceptResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1")),
            pickupResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-1")),
            dropoffResult: .success(.init(jobId: "job-1", orderId: "order-1", status: "DROPPED_OFF", courierId: "courier-1"))
        )

        let model = CourierJobConsoleViewModel(client: client)
        model.courierId = "courier-1"
        model.jobs = [
            .init(jobId: "job-1", orderId: "order-1", status: "ACCEPTED", courierId: "courier-1"),
        ]

        await model.pickup(jobId: "job-1")
        #expect(model.jobs.first?.status == "PICKED_UP")
        #expect(await client.pickupCallCount == 1)

        await model.dropoff(jobId: "job-1")
        #expect(model.jobs.first?.status == "DROPPED_OFF")
        #expect(await client.dropoffCallCount == 1)
    }
}

enum FakeCourierJobsClientError: Error {
    case stub
}

actor FakeCourierSessionClient: CourierSessionClient {
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

actor FakeCourierJobsClient: CourierJobsClient {
    private let loadJobsResult: Result<[CourierJob], Error>
    private let acceptResult: Result<CourierJob, Error>
    private let pickupResult: Result<CourierJob, Error>
    private let dropoffResult: Result<CourierJob, Error>

    private(set) var loadCallCount = 0
    private(set) var acceptCallCount = 0
    private(set) var pickupCallCount = 0
    private(set) var dropoffCallCount = 0

    init(
        loadJobsResult: Result<[CourierJob], Error>,
        acceptResult: Result<CourierJob, Error>,
        pickupResult: Result<CourierJob, Error>,
        dropoffResult: Result<CourierJob, Error>
    ) {
        self.loadJobsResult = loadJobsResult
        self.acceptResult = acceptResult
        self.pickupResult = pickupResult
        self.dropoffResult = dropoffResult
    }

    func fetchAvailableJobs() async throws -> [CourierJob] {
        loadCallCount += 1
        return try loadJobsResult.get()
    }

    func acceptJob(jobId: String, courierId: String) async throws -> CourierJob {
        acceptCallCount += 1
        return try acceptResult.get()
    }

    func pickupJob(jobId: String, courierId: String) async throws -> CourierJob {
        pickupCallCount += 1
        return try pickupResult.get()
    }

    func dropoffJob(jobId: String, courierId: String) async throws -> CourierJob {
        dropoffCallCount += 1
        return try dropoffResult.get()
    }
}

private func makeCourierSessionResponse(
    userId: String,
    accessToken: String,
    refreshToken: String
) -> SessionExchangeResponse {
    SessionExchangeResponse(
        session: AppSession(
            sessionId: "session-\(accessToken)",
            userId: userId,
            role: "courier",
            persona: "courier",
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
