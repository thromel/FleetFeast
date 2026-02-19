import Foundation

public enum CourierShellConfigError: Error {
    case invalidBaseURL(field: String)
}

public struct CourierAppShellConfig {
    public let bffBaseURL: URL
    public let realtimeBaseURL: URL

    public init(bffBaseURL: URL, realtimeBaseURL: URL) {
        self.bffBaseURL = bffBaseURL
        self.realtimeBaseURL = realtimeBaseURL
    }

    public init(bffBaseURLString: String, realtimeBaseURLString: String) throws {
        guard let bffBaseURL = URL(string: bffBaseURLString),
              let bffScheme = bffBaseURL.scheme,
              bffScheme == "http" || bffScheme == "https" else {
            throw CourierShellConfigError.invalidBaseURL(field: "bffBaseURL")
        }

        guard let realtimeBaseURL = URL(string: realtimeBaseURLString),
              let realtimeScheme = realtimeBaseURL.scheme,
              realtimeScheme == "http" || realtimeScheme == "https" else {
            throw CourierShellConfigError.invalidBaseURL(field: "realtimeBaseURL")
        }

        self.bffBaseURL = bffBaseURL
        self.realtimeBaseURL = realtimeBaseURL
    }
}

public struct CourierAppShell {
    public let config: CourierAppShellConfig

    public init(config: CourierAppShellConfig) {
        self.config = config
    }

    public func startupSummary() -> String {
        return "Courier iOS shell configured for \(config.bffBaseURL.absoluteString) with realtime \(config.realtimeBaseURL.absoluteString)"
    }

    public func availableJobsPath() -> String {
        return "/app/v1/courier/jobs/available"
    }

    public func featureFlagPath(userId: String, role: String, tenantId: String?) -> String {
        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "userId", value: userId),
            URLQueryItem(name: "role", value: role),
        ]

        if let tenantId {
            components.queryItems?.append(URLQueryItem(name: "tenantId", value: tenantId))
        }

        let query = components.percentEncodedQuery ?? ""
        return "/app/v1/courier/feature-flags?\(query)"
    }

    public func realtimeConnectPath() -> String {
        return "/app/v1/realtime/connect"
    }

    public func makeBackendClient(httpClient: HTTPClient = URLSessionHTTPClient()) -> CourierBackendClient {
        CourierBackendClient(
            baseURL: config.bffBaseURL,
            httpClient: httpClient
        )
    }

    public func makeAuthSessionManager(httpClient: HTTPClient = URLSessionHTTPClient()) -> CourierAuthSessionManager {
        CourierAuthSessionManager(
            client: makeBackendClient(httpClient: httpClient)
        )
    }
}
