import { credentials, loadPackageDefinition, type ServiceError } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DispatchAssignmentClient,
  DispatchAssignmentDecision,
  DispatchAssignmentInput,
} from "./dispatch-assignment-client.js";

interface AssignGrpcCandidate {
  courier_id: string;
  distance_meters: number;
  available: boolean;
  active_orders: number;
  within_rest_window: boolean;
}

interface AssignGrpcRequest {
  order_id: string;
  candidates: AssignGrpcCandidate[];
  sla_pressure: number;
  merchant_self_delivery_enabled: boolean;
}

interface AssignGrpcResponse {
  assignment_id?: string;
  mode?: string;
  courier_id?: string;
  eta_seconds?: number;
  reason_codes?: string[];
}

interface DispatchServiceClientInstance {
  Assign(
    request: AssignGrpcRequest,
    callback: (error: ServiceError | null, response: AssignGrpcResponse) => void,
  ): void;
  close(): void;
}

interface DispatchServiceClientConstructor {
  new (address: string, channelCredentials: ReturnType<typeof credentials.createInsecure>): DispatchServiceClientInstance;
}

interface DispatchPackageShape {
  dispatch: {
    v1: {
      DispatchService: DispatchServiceClientConstructor;
    };
  };
}

function resolveDispatchProtoPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  return resolve(currentDir, "../../../../contracts/protobuf/dispatch/v1/dispatch.proto");
}

function createGrpcClient(address: string): DispatchServiceClientInstance {
  const packageDefinition = loadSync(resolveDispatchProtoPath(), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const loadedPackage = loadPackageDefinition(packageDefinition) as unknown as DispatchPackageShape;
  const DispatchService = loadedPackage.dispatch.v1.DispatchService;
  return new DispatchService(address, credentials.createInsecure());
}

export class GrpcDispatchAssignmentClient implements DispatchAssignmentClient {
  private readonly client: DispatchServiceClientInstance;

  constructor(address: string) {
    this.client = createGrpcClient(address);
  }

  async assign(input: DispatchAssignmentInput): Promise<DispatchAssignmentDecision> {
    const request: AssignGrpcRequest = {
      order_id: input.orderId,
      candidates: input.candidates.map((candidate) => ({
        courier_id: candidate.courierId,
        distance_meters: candidate.distanceMeters,
        available: candidate.available,
        active_orders: candidate.activeOrders,
        within_rest_window: candidate.withinRestWindow,
      })),
      sla_pressure: input.slaPressure,
      merchant_self_delivery_enabled: input.merchantSelfDeliveryEnabled,
    };

    const response = await new Promise<AssignGrpcResponse>((resolveResponse, rejectResponse) => {
      this.client.Assign(request, (error, grpcResponse) => {
        if (error) {
          rejectResponse(error);
          return;
        }

        resolveResponse(grpcResponse);
      });
    });

    return {
      assignmentId: response.assignment_id ?? "",
      mode: response.mode ?? "UNASSIGNED",
      courierId: response.courier_id && response.courier_id.length > 0 ? response.courier_id : null,
      etaSeconds: response.eta_seconds ?? 0,
      reasonCodes: response.reason_codes ?? [],
    };
  }

  close(): void {
    this.client.close();
  }
}
