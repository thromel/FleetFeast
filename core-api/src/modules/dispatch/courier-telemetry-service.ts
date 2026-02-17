export interface IngestCourierTelemetryInput {
  courierId: string;
  observedAtEpochMs: number;
  speedMps: number;
  distanceToDropoffMeters: number;
}

export interface CourierTelemetryDecision {
  accepted: boolean;
  dropReason: string;
  etaSeconds: number;
}

export class CourierTelemetryService {
  private readonly lastSeenByCourier = new Map<string, number>();
  private readonly minEtaSeconds = 30;

  ingest(input: IngestCourierTelemetryInput): CourierTelemetryDecision {
    const lastSeen = this.lastSeenByCourier.get(input.courierId);
    if (typeof lastSeen === "number" && input.observedAtEpochMs <= lastSeen) {
      return {
        accepted: false,
        dropReason: "OUT_OF_ORDER",
        etaSeconds: 0,
      };
    }

    this.lastSeenByCourier.set(input.courierId, input.observedAtEpochMs);

    const distance = Math.max(0, input.distanceToDropoffMeters);
    const speed = input.speedMps > 0 ? input.speedMps : 4;
    const etaSeconds = Math.max(this.minEtaSeconds, Math.ceil(distance / speed));

    return {
      accepted: true,
      dropReason: "",
      etaSeconds,
    };
  }
}
