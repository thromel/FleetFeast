export interface DispatchAssignmentCandidate {
  courierId: string;
  distanceMeters: number;
  available: boolean;
  activeOrders: number;
  withinRestWindow: boolean;
}

export interface DispatchAssignmentInput {
  orderId: string;
  candidates: DispatchAssignmentCandidate[];
  slaPressure: number;
  merchantSelfDeliveryEnabled: boolean;
}

export interface DispatchAssignmentDecision {
  assignmentId: string;
  mode: string;
  courierId: string | null;
  etaSeconds: number;
  reasonCodes: string[];
}

export interface DispatchAssignmentClient {
  assign(input: DispatchAssignmentInput): Promise<DispatchAssignmentDecision>;
}
