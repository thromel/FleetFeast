import Foundation

public enum ConsumerShellConfigError: Error {
    case invalidBaseURL(field: String)
}

public struct ConsumerAppShellConfig {
    public let bffBaseURL: URL

    public init(bffBaseURL: URL) {
        self.bffBaseURL = bffBaseURL
    }

    public init(bffBaseURLString: String) throws {
        guard let bffBaseURL = URL(string: bffBaseURLString),
              let scheme = bffBaseURL.scheme,
              scheme == "http" || scheme == "https" else {
            throw ConsumerShellConfigError.invalidBaseURL(field: "bffBaseURL")
        }

        self.bffBaseURL = bffBaseURL
    }
}

public struct ConsumerAppShell {
    public let config: ConsumerAppShellConfig

    public init(config: ConsumerAppShellConfig) {
        self.config = config
    }

    public func startupSummary() -> String {
        return "Consumer iOS shell configured for \(config.bffBaseURL.absoluteString)"
    }

    public func orderPath(orderId: String) -> String {
        return "/app/v1/consumer/orders/\(orderId)"
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
        return "/app/v1/consumer/feature-flags?\(query)"
    }

    public func makeBackendClient(httpClient: HTTPClient = URLSessionHTTPClient()) -> ConsumerBackendClient {
        ConsumerBackendClient(
            baseURL: config.bffBaseURL,
            httpClient: httpClient
        )
    }

    public func makeAuthSessionManager(httpClient: HTTPClient = URLSessionHTTPClient()) -> ConsumerAuthSessionManager {
        ConsumerAuthSessionManager(
            client: makeBackendClient(httpClient: httpClient)
        )
    }
}
