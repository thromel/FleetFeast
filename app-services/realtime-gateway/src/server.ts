import Fastify, { type FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { WebSocket } from "ws";

import { isRealtimeEnvelope, type RealtimeEnvelope } from "@fleetfeast/shared-contracts";

type ChannelSubscribers = Map<string, Set<WebSocket>>;

export interface RealtimeGateway {
  app: FastifyInstance;
  publishToChannel(channel: string, envelope: RealtimeEnvelope): void;
}

export function createRealtimeGatewayServer(): RealtimeGateway {
  const app = Fastify();
  const subscribers: ChannelSubscribers = new Map();

  app.register(async (instance) => {
    await instance.register(websocketPlugin);

    instance.route({
      method: "GET",
      url: "/app/v1/realtime/connect",
      handler: async (_request, reply) => {
        reply.status(426);
        return {
          errorCode: "WEBSOCKET_UPGRADE_REQUIRED",
          message: "Use websocket upgrade for this endpoint",
        };
      },
      wsHandler: (socket, request) => {
        const query = (request.query ?? {}) as { channel?: unknown };
        if (typeof query.channel !== "string" || query.channel.trim().length === 0) {
          socket.close(1008, "channel is required");
          return;
        }

        const channel = query.channel;
        const channelSet = subscribers.get(channel) ?? new Set<WebSocket>();
        channelSet.add(socket);
        subscribers.set(channel, channelSet);

        socket.on("close", () => {
          const current = subscribers.get(channel);
          if (!current) {
            return;
          }

          current.delete(socket);
          if (current.size === 0) {
            subscribers.delete(channel);
          }
        });
      },
    });
  });

  return {
    app,
    publishToChannel(channel: string, envelope: RealtimeEnvelope): void {
      if (!isRealtimeEnvelope(envelope)) {
        throw new Error("INVALID_REALTIME_ENVELOPE");
      }

      const channelSet = subscribers.get(channel);
      if (!channelSet) {
        return;
      }

      const payload = JSON.stringify(envelope);
      for (const socket of channelSet) {
        if (socket.readyState !== WebSocket.OPEN) {
          continue;
        }

        socket.send(payload);
      }
    },
  };
}
