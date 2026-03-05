import CourierIOSShell
import Foundation

typealias CourierJob = CourierIOSShell.CourierJob

protocol CourierJobsClient: Sendable {
    func fetchAvailableJobs() async throws -> [CourierJob]
    func acceptJob(jobId: String, courierId: String) async throws -> CourierJob
    func pickupJob(jobId: String, courierId: String) async throws -> CourierJob
    func dropoffJob(jobId: String, courierId: String) async throws -> CourierJob
}

@MainActor
final class CourierJobConsoleViewModel: ObservableObject {
    @Published var baseURLString = "http://127.0.0.1:4102"
    @Published var courierId = "courier-1"

    @Published var isBusy = false
    @Published var lastError: String?
    @Published var jobs: [CourierJob] = []

    private let client: CourierJobsClient?

    init(client: CourierJobsClient? = nil) {
        self.client = client
    }

    func loadJobs() async {
        isBusy = true
        defer { isBusy = false }

        guard let backendClient = resolveClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            jobs = try await backendClient.fetchAvailableJobs()
            lastError = nil
        } catch {
            jobs = []
            lastError = String(describing: error)
        }
    }

    func accept(jobId: String) async {
        await applyAction(jobId: jobId, action: .accept)
    }

    func pickup(jobId: String) async {
        await applyAction(jobId: jobId, action: .pickup)
    }

    func dropoff(jobId: String) async {
        await applyAction(jobId: jobId, action: .dropoff)
    }

    private func applyAction(jobId: String, action: CourierJobAction) async {
        isBusy = true
        defer { isBusy = false }

        guard let backendClient = resolveClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            let updatedJob: CourierJob
            switch action {
            case .accept:
                updatedJob = try await backendClient.acceptJob(jobId: jobId, courierId: courierId)
            case .pickup:
                updatedJob = try await backendClient.pickupJob(jobId: jobId, courierId: courierId)
            case .dropoff:
                updatedJob = try await backendClient.dropoffJob(jobId: jobId, courierId: courierId)
            }

            if let index = jobs.firstIndex(where: { $0.jobId == updatedJob.jobId }) {
                jobs[index] = updatedJob
            } else {
                jobs.insert(updatedJob, at: 0)
            }
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    private func resolveClient() -> CourierJobsClient? {
        if let client {
            return client
        }

        guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        return CourierBackendJobsClient(baseURL: baseURL)
    }
}

private enum CourierJobAction {
    case accept
    case pickup
    case dropoff
}

private struct CourierBackendJobsClient: CourierJobsClient {
    let baseURL: URL

    func fetchAvailableJobs() async throws -> [CourierJob] {
        let client = CourierBackendClient(baseURL: baseURL)
        return try await client.fetchAvailableJobs()
    }

    func acceptJob(jobId: String, courierId: String) async throws -> CourierJob {
        let client = CourierBackendClient(baseURL: baseURL)
        return try await client.acceptJob(jobId: jobId, courierId: courierId)
    }

    func pickupJob(jobId: String, courierId: String) async throws -> CourierJob {
        let client = CourierBackendClient(baseURL: baseURL)
        return try await client.pickupJob(jobId: jobId, courierId: courierId)
    }

    func dropoffJob(jobId: String, courierId: String) async throws -> CourierJob {
        let client = CourierBackendClient(baseURL: baseURL)
        return try await client.dropoffJob(jobId: jobId, courierId: courierId)
    }
}
