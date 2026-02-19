import Foundation

public enum ConsumerAuthSessionManagerError: Error {
    case missingSession
}

public struct ConsumerAuthSessionManager {
    private let client: ConsumerBackendClient
    private var activeSession: SessionExchangeResponse?

    public init(client: ConsumerBackendClient) {
        self.client = client
    }

    public mutating func signIn(
        oidcToken: String,
        traceId: String,
        deviceId: String
    ) async throws -> SessionExchangeResponse {
        let response = try await client.exchangeSession(
            oidcToken: oidcToken,
            traceId: traceId,
            deviceId: deviceId
        )
        activeSession = response
        return response
    }

    public mutating func refresh(
        traceId: String,
        deviceId: String
    ) async throws -> SessionExchangeResponse {
        guard let refreshToken = activeSession?.tokenPair.refreshToken else {
            throw ConsumerAuthSessionManagerError.missingSession
        }

        let response = try await client.refreshSession(
            refreshToken: refreshToken,
            traceId: traceId,
            deviceId: deviceId
        )
        activeSession = response
        return response
    }

    public func currentSession() -> SessionExchangeResponse? {
        activeSession
    }
}
