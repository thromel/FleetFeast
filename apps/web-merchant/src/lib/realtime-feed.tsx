"use client";

import { useEffect, useMemo, useState } from "react";

interface RealtimeEnvelope {
  eventType: string;
  entityId: string;
  occurredAt: string;
  traceId: string;
  payload: unknown;
}

interface MerchantRealtimeFeedProps {
  orderId: string;
}

function toWsBaseUrl(baseUrl: string): string {
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}`;
  }

  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}`;
  }

  return baseUrl;
}

export function MerchantRealtimeFeed({ orderId }: MerchantRealtimeFeedProps): JSX.Element {
  const [events, setEvents] = useState<RealtimeEnvelope[]>([]);
  const [connectionState, setConnectionState] = useState("CONNECTING");
  const channel = useMemo(() => `merchant.order.${orderId}`, [orderId]);

  useEffect(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_REALTIME_GATEWAY_BASE_URL ?? "http://127.0.0.1:4104";
    const wsUrl = `${toWsBaseUrl(baseUrl).replace(/\/+$/, "")}/app/v1/realtime/connect?channel=${encodeURIComponent(channel)}`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      setConnectionState("CONNECTED");
    });
    socket.addEventListener("close", () => {
      setConnectionState("DISCONNECTED");
    });
    socket.addEventListener("error", () => {
      setConnectionState("ERROR");
    });
    socket.addEventListener("message", (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as RealtimeEnvelope;
        setEvents((current) => [envelope, ...current].slice(0, 10));
      } catch {
        // Ignore malformed messages and keep connection alive.
      }
    });

    return () => {
      socket.close();
    };
  }, [channel]);

  return (
    <div className="realtime-panel">
      <p className="meta">
        Channel: <strong>{channel}</strong> · <span className="chip">{connectionState}</span>
      </p>
      {events.length === 0 ? (
        <p className="meta">Waiting for order/dispatch events...</p>
      ) : (
        <ul className="list">
          {events.map((event, index) => (
            <li key={`${event.traceId}-${index}`} className="item">
              <span>{event.eventType}</span>
              <span className="chip">{new Date(event.occurredAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
