import CourierIOSShell
import Foundation

typealias CourierJob = CourierIOSShell.CourierJob

typealias AppSession = CourierIOSShell.AppSession

typealias AppSessionTokenPair = CourierIOSShell.AppSessionTokenPair

typealias SessionExchangeResponse = CourierIOSShell.SessionExchangeResponse

protocol CourierJobsClient: Sendable {
    func fetchAvailableJobs() async throws -> [CourierJob]
    func acceptJob(jobId: String, courierId: String) async throws -> CourierJob
    func pickupJob(jobId: String, courierId: String) async throws -> CourierJob
    func dropoffJob(jobId: String, courierId: String) async throws -> CourierJob
}

protocol CourierSessionClient: Sendable {
    func signIn(oidcToken: String) async throws -> SessionExchangeResponse
    func refreshSession() async throws -> SessionExchangeResponse
}

@MainActor
final class CourierJobConsoleViewModel: ObservableObject {
    @Published var baseURLString = "http://127.0.0.1:4102"
    @Published var oidcToken = "dev:courier-1:courier-1@fleetfeast.dev:courier"
    @Published var courierId = "courier-1"

    @Published var isBusy = false
    @Published var lastError: String?
    @Published var jobs: [CourierJob] = []
    @Published var session: SessionExchangeResponse?

    private let client: CourierJobsClient?
    private let sessionClient: CourierSessionClient?
    private var liveSessionClient: CourierSessionClient?

    init(
        client: CourierJobsClient? = nil,
        sessionClient: CourierSessionClient? = nil
    ) {
        self.client = client
        self.sessionClient = sessionClient
        self.liveSessionClient = sessionClient
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

    func signIn() async {
        isBusy = true
        defer { isBusy = false }

        guard let sessionClient = resolveSessionClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            let signedInSession = try await sessionClient.signIn(oidcToken: oidcToken)
            session = signedInSession
            courierId = signedInSession.session.userId
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    func refreshSession() async {
        isBusy = true
        defer { isBusy = false }

        guard let sessionClient = resolveSessionClient() else {
            lastError = "Invalid base URL"
            return
        }

        do {
            let refreshedSession = try await sessionClient.refreshSession()
            session = refreshedSession
            courierId = refreshedSession.session.userId
            lastError = nil
        } catch {
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

    private func resolveSessionClient() -> CourierSessionClient? {
        if let liveSessionClient {
            return liveSessionClient
        }

        guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        let sessionClient = CourierBackendSessionClient(baseURL: baseURL)
        liveSessionClient = sessionClient
        return sessionClient
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

private actor CourierBackendSessionClient: CourierSessionClient {
    private let baseURL: URL
    private var activeSession: SessionExchangeResponse?

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func signIn(oidcToken: String) async throws -> SessionExchangeResponse {
        let client = CourierBackendClient(baseURL: baseURL)
        let response = try await client.exchangeSession(
            oidcToken: oidcToken,
            traceId: "ios-courier-signin-\(UUID().uuidString.lowercased())",
            deviceId: "courier-ios-local"
        )
        activeSession = response
        return response
    }

    func refreshSession() async throws -> SessionExchangeResponse {
        guard let refreshToken = activeSession?.tokenPair.refreshToken else {
            throw CourierAuthSessionManagerError.missingSession
        }

        let client = CourierBackendClient(baseURL: baseURL)
        let response = try await client.refreshSession(
            refreshToken: refreshToken,
            traceId: "ios-courier-refresh-\(UUID().uuidString.lowercased())",
            deviceId: "courier-ios-local"
        )
        activeSession = response
        return response
    }
}
