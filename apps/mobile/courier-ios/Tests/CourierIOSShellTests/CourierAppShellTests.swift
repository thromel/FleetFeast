import Testing
@testable import CourierIOSShell

struct CourierAppShellTests {
    @Test
    func startupSummaryUsesConfiguredUrls() throws {
        let config = try CourierAppShellConfig(
            bffBaseURLString: "http://127.0.0.1:4102",
            realtimeBaseURLString: "http://127.0.0.1:4104"
        )
        let shell = CourierAppShell(config: config)

        #expect(shell.startupSummary() == "Courier iOS shell configured for http://127.0.0.1:4102 with realtime http://127.0.0.1:4104")
        #expect(shell.availableJobsPath() == "/app/v1/courier/jobs/available")
        #expect(shell.realtimeConnectPath() == "/app/v1/realtime/connect")
    }

    @Test
    func featureFlagPathIncludesContextQuery() throws {
        let config = try CourierAppShellConfig(
            bffBaseURLString: "http://127.0.0.1:4102",
            realtimeBaseURLString: "http://127.0.0.1:4104"
        )
        let shell = CourierAppShell(config: config)

        let path = shell.featureFlagPath(userId: "courier-1", role: "courier", tenantId: "metro-1")

        #expect(path.contains("/app/v1/courier/feature-flags?"))
        #expect(path.contains("userId=courier-1"))
        #expect(path.contains("role=courier"))
        #expect(path.contains("tenantId=metro-1"))
    }

    @Test
    func invalidUrlThrows() {
        #expect(throws: CourierShellConfigError.self) {
            _ = try CourierAppShellConfig(
                bffBaseURLString: "not-a-url",
                realtimeBaseURLString: "http://127.0.0.1:4104"
            )
        }
    }
}
