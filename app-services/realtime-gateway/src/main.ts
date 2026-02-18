import { createRealtimeGatewayServerFromEnv } from "./server.js";

const port = Number(process.env.PORT ?? 4104);
const gateway = createRealtimeGatewayServerFromEnv();

gateway.app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`[realtime-gateway] listening on port ${port}`);
});
