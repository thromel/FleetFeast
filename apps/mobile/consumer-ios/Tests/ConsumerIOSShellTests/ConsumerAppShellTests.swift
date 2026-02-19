import Testing
@testable import ConsumerIOSShell

struct ConsumerAppShellTests {
    @Test
    func startupSummaryUsesConfiguredUrl() throws {
        let config = try ConsumerAppShellConfig(bffBaseURLString: "http://127.0.0.1:4101")
        let shell = ConsumerAppShell(config: config)

        #expect(shell.startupSummary() == "Consumer iOS shell configured for http://127.0.0.1:4101")
        #expect(shell.orderPath(orderId: "order-1") == "/app/v1/consumer/orders/order-1")
    }

    @Test
    func featureFlagPathIncludesContextQuery() throws {
        let config = try ConsumerAppShellConfig(bffBaseURLString: "http://127.0.0.1:4101")
        let shell = ConsumerAppShell(config: config)

        let path = shell.featureFlagPath(userId: "consumer-1", role: "consumer", tenantId: "metro-1")

        #expect(path.contains("/app/v1/consumer/feature-flags?"))
        #expect(path.contains("userId=consumer-1"))
        #expect(path.contains("role=consumer"))
        #expect(path.contains("tenantId=metro-1"))
    }

    @Test
    func invalidUrlThrows() {
        #expect(throws: ConsumerShellConfigError.self) {
            _ = try ConsumerAppShellConfig(bffBaseURLString: "not-a-url")
        }
    }
}
