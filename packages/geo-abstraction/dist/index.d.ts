export interface GeoPoint {
    latitude: number;
    longitude: number;
}
export interface RouteEstimateInput {
    origin: GeoPoint;
    destination: GeoPoint;
}
export interface RouteEstimate {
    provider: string;
    distanceMeters: number;
    etaSeconds: number;
}
export interface GeoProvider {
    name: string;
    estimateRoute(input: RouteEstimateInput): Promise<RouteEstimate>;
}
export interface GeoProviderRegistry {
    getProvider(name?: string): GeoProvider;
}
export declare class InMemoryGeoProvider implements GeoProvider {
    readonly name: string;
    private readonly defaults;
    constructor(name: string, defaults: {
        etaSeconds: number;
        distanceMeters: number;
    });
    estimateRoute(_input: RouteEstimateInput): Promise<RouteEstimate>;
}
export declare function createGeoProviderRegistry(input: {
    defaultProvider: string;
    providers: GeoProvider[];
}): GeoProviderRegistry;
