import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryGeoProvider, createGeoProviderRegistry } from "./index.js";
test("geo registry resolves selected provider and delegates operations", async () => {
    const mapbox = new InMemoryGeoProvider("mapbox", {
        etaSeconds: 500,
        distanceMeters: 1400,
    });
    const google = new InMemoryGeoProvider("google", {
        etaSeconds: 420,
        distanceMeters: 1300,
    });
    const registry = createGeoProviderRegistry({
        defaultProvider: "mapbox",
        providers: [mapbox, google],
    });
    const route = await registry.getProvider("google").estimateRoute({
        origin: { latitude: 40.7, longitude: -74.0 },
        destination: { latitude: 40.8, longitude: -73.9 },
    });
    assert.equal(route.provider, "google");
    assert.equal(route.distanceMeters, 1300);
    assert.equal(route.etaSeconds, 420);
});
//# sourceMappingURL=index.test.js.map