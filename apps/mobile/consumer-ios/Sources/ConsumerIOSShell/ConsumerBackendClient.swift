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

public struct ConsumerOrder: Decodable, Sendable {
    public let id: String
    public let status: String
    public let timelineVersion: Int

    public init(id: String, status: String, timelineVersion: Int) {
        self.id = id
        self.status = status
        self.timelineVersion = timelineVersion
    }
}

public struct ConsumerQuickOrderModifier: Codable, Sendable {
    public let name: String
    public let priceCents: Int

    public init(name: String, priceCents: Int) {
        self.name = name
        self.priceCents = priceCents
    }
}

public struct ConsumerQuickOrderItem: Codable, Sendable {
    public let itemId: String
    public let name: String
    public let quantity: Int
    public let unitPriceCents: Int
    public let modifiers: [ConsumerQuickOrderModifier]

    public init(
        itemId: String,
        name: String,
        quantity: Int,
        unitPriceCents: Int,
        modifiers: [ConsumerQuickOrderModifier]
    ) {
        self.itemId = itemId
        self.name = name
        self.quantity = quantity
        self.unitPriceCents = unitPriceCents
        self.modifiers = modifiers
    }
}

public struct FeatureFlagSnapshot: Decodable, Sendable {
    public let flags: [String: Bool]
    public let ttlSeconds: Int
    public let generatedAtEpochMillis: Int64
}

public struct AppSession: Decodable, Sendable {
    public let sessionId: String
    public let userId: String
    public let role: String
    public let persona: String
    public let traceId: String
    public let refreshTokenId: String
    public let issuedAt: String
    public let expiresAt: String

    public init(
        sessionId: String,
        userId: String,
        role: String,
        persona: String,
        traceId: String,
        refreshTokenId: String,
        issuedAt: String,
        expiresAt: String
    ) {
        self.sessionId = sessionId
        self.userId = userId
        self.role = role
        self.persona = persona
        self.traceId = traceId
        self.refreshTokenId = refreshTokenId
        self.issuedAt = issuedAt
        self.expiresAt = expiresAt
    }
}

public struct AppSessionTokenPair: Decodable, Sendable {
    public let tokenType: String
    public let accessToken: String
    public let refreshToken: String
    public let expiresInSeconds: Int
    public let refreshExpiresInSeconds: Int
    public let refreshExpiresAt: String

    public init(
        tokenType: String,
        accessToken: String,
        refreshToken: String,
        expiresInSeconds: Int,
        refreshExpiresInSeconds: Int,
        refreshExpiresAt: String
    ) {
        self.tokenType = tokenType
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresInSeconds = expiresInSeconds
        self.refreshExpiresInSeconds = refreshExpiresInSeconds
        self.refreshExpiresAt = refreshExpiresAt
    }
}

public struct SessionExchangeResponse: Decodable, Sendable {
    public let session: AppSession
    public let tokenPair: AppSessionTokenPair

    public init(session: AppSession, tokenPair: AppSessionTokenPair) {
        self.session = session
        self.tokenPair = tokenPair
    }
}

public enum ConsumerBackendClientError: Error {
    case invalidResponse
    case requestFailed(statusCode: Int)
}

private struct ConsumerOrderEnvelope: Decodable {
    let order: ConsumerOrder
}

private struct ConsumerQuickCreateOrderRequest: Encodable {
    let consumerId: String
    let merchantId: String
    let currency: String
    let item: ConsumerQuickOrderItem
}

private struct ConsumerSessionExchangeRequest: Encodable {
    let oidcToken: String
    let traceId: String
    let deviceId: String
}

private struct ConsumerSessionRefreshRequest: Encodable {
    let refreshToken: String
    let traceId: String
    let deviceId: String
}

public struct ConsumerBackendClient {
    private let baseURL: URL
    private let httpClient: HTTPClient
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(baseURL: URL, httpClient: HTTPClient = URLSessionHTTPClient()) {
        self.baseURL = baseURL
        self.httpClient = httpClient
    }

    public func fetchOrder(orderId: String) async throws -> ConsumerOrder {
        let data = try await performGET(path: "/app/v1/consumer/orders/\(orderId)")
        return try decoder.decode(ConsumerOrderEnvelope.self, from: data).order
    }

    public func createQuickOrder(
        consumerId: String,
        merchantId: String,
        currency: String,
        item: ConsumerQuickOrderItem
    ) async throws -> ConsumerOrder {
        let requestBody = ConsumerQuickCreateOrderRequest(
            consumerId: consumerId,
            merchantId: merchantId,
            currency: currency,
            item: item
        )
        let data = try await performPOST(
            path: "/app/v1/consumer/orders/quick-create",
            body: try encoder.encode(requestBody)
        )
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

    public func exchangeSession(
        oidcToken: String,
        traceId: String,
        deviceId: String
    ) async throws -> SessionExchangeResponse {
        let requestBody = ConsumerSessionExchangeRequest(
            oidcToken: oidcToken,
            traceId: traceId,
            deviceId: deviceId
        )
        let data = try await performPOST(
            path: "/app/v1/consumer/session/exchange",
            body: try encoder.encode(requestBody)
        )
        return try decoder.decode(SessionExchangeResponse.self, from: data)
    }

    public func refreshSession(
        refreshToken: String,
        traceId: String,
        deviceId: String
    ) async throws -> SessionExchangeResponse {
        let requestBody = ConsumerSessionRefreshRequest(
            refreshToken: refreshToken,
            traceId: traceId,
            deviceId: deviceId
        )
        let data = try await performPOST(
            path: "/app/v1/consumer/session/refresh",
            body: try encoder.encode(requestBody)
        )
        return try decoder.decode(SessionExchangeResponse.self, from: data)
    }

    private func performGET(
        path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Data {
        try await performRequest(
            method: "GET",
            path: path,
            queryItems: queryItems
        )
    }

    private func performPOST(
        path: String,
        body: Data
    ) async throws -> Data {
        try await performRequest(
            method: "POST",
            path: path,
            body: body,
            contentType: "application/json"
        )
    }

    private func performRequest(
        method: String,
        path: String,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        contentType: String? = nil
    ) async throws -> Data {
        let base = baseURL.absoluteString.replacingOccurrences(of: "/$", with: "", options: .regularExpression)
        var components = URLComponents(string: "\(base)\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let finalURL = components?.url else {
            throw ConsumerBackendClientError.invalidResponse
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = method
        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "content-type")
        }
        request.httpBody = body

        let (data, response) = try await httpClient.request(request)
        guard (200...299).contains(response.statusCode) else {
            throw ConsumerBackendClientError.requestFailed(statusCode: response.statusCode)
        }

        return data
    }
}
