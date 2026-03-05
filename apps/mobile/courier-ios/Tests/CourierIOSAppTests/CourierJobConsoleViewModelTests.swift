import Foundation
import Testing
@testable import CourierIOSApp

@MainActor
struct CourierJobConsoleViewModelTests {
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
