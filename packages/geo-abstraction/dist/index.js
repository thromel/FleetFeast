export class InMemoryGeoProvider {
    name;
    defaults;
    constructor(name, defaults) {
        this.name = name;
        this.defaults = defaults;
    }
    async estimateRoute(_input) {
        return {
            provider: this.name,
            distanceMeters: this.defaults.distanceMeters,
            etaSeconds: this.defaults.etaSeconds,
        };
    }
}
export function createGeoProviderRegistry(input) {
    const byName = new Map(input.providers.map((provider) => [provider.name, provider]));
    return {
        getProvider(name) {
            const selectedName = name ?? input.defaultProvider;
            const selected = byName.get(selectedName);
            if (!selected) {
                throw new Error(`GEO_PROVIDER_NOT_FOUND:${selectedName}`);
            }
            return selected;
        },
    };
}
//# sourceMappingURL=index.js.map