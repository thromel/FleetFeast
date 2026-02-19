import Foundation

public protocol HTTPClient {
    func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionHTTPClient: HTTPClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func request(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ConsumerBackendClientError.invalidResponse
        }

        return (data, httpResponse)
    }
}

public struct ConsumerOrder: Decodable {
    public let id: String
    public let status: String
    public let timelineVersion: Int
}

public struct FeatureFlagSnapshot: Decodable {
    public let flags: [String: Bool]
    public let ttlSeconds: Int
    public let generatedAtEpochMillis: Int64
}

public enum ConsumerBackendClientError: Error {
    case invalidResponse
    case requestFailed(statusCode: Int)
}

private struct ConsumerOrderEnvelope: Decodable {
    let order: ConsumerOrder
}

public struct ConsumerBackendClient {
    private let baseURL: URL
    private let httpClient: HTTPClient
    private let decoder = JSONDecoder()

    public init(baseURL: URL, httpClient: HTTPClient = URLSessionHTTPClient()) {
        self.baseURL = baseURL
        self.httpClient = httpClient
    }

    public func fetchOrder(orderId: String) async throws -> ConsumerOrder {
        let data = try await performGET(path: "/app/v1/consumer/orders/\(orderId)")
        return try decoder.decode(ConsumerOrderEnvelope.self, from: data).order
    }

    public func fetchFeatureFlags(
        userId: String,
        role: String,
        tenantId: String?
    ) async throws -> FeatureFlagSnapshot {
        var queryItems = [
            URLQueryItem(name: "userId", value: userId),
            URLQueryItem(name: "role", value: role),
        ]
        if let tenantId {
            queryItems.append(URLQueryItem(name: "tenantId", value: tenantId))
        }

        let data = try await performGET(
            path: "/app/v1/consumer/feature-flags",
            queryItems: queryItems
        )
        return try decoder.decode(FeatureFlagSnapshot.self, from: data)
    }

    private func performGET(
        path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Data {
        let base = baseURL.absoluteString.replacingOccurrences(of: "/$", with: "", options: .regularExpression)
        var components = URLComponents(string: "\(base)\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let finalURL = components?.url else {
            throw ConsumerBackendClientError.invalidResponse
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"

        let (data, response) = try await httpClient.request(request)
        guard (200...299).contains(response.statusCode) else {
            throw ConsumerBackendClientError.requestFailed(statusCode: response.statusCode)
        }

        return data
    }
}
