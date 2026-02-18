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

export class InMemoryGeoProvider implements GeoProvider {
  constructor(
    public readonly name: string,
    private readonly defaults: {
      etaSeconds: number;
      distanceMeters: number;
    },
  ) {}

  async estimateRoute(_input: RouteEstimateInput): Promise<RouteEstimate> {
    return {
      provider: this.name,
      distanceMeters: this.defaults.distanceMeters,
      etaSeconds: this.defaults.etaSeconds,
    };
  }
}

export function createGeoProviderRegistry(input: {
  defaultProvider: string;
  providers: GeoProvider[];
}): GeoProviderRegistry {
  const byName = new Map(input.providers.map((provider) => [provider.name, provider]));

  return {
    getProvider(name?: string): GeoProvider {
      const selectedName = name ?? input.defaultProvider;
      const selected = byName.get(selectedName);
      if (!selected) {
        throw new Error(`GEO_PROVIDER_NOT_FOUND:${selectedName}`);
      }

      return selected;
    },
  };
}
