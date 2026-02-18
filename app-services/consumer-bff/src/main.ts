import { createConsumerBffServerFromEnv } from "./server.js";

const port = Number(process.env.PORT ?? 4101);
const app = createConsumerBffServerFromEnv();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`[consumer-bff] listening on port ${port}`);
});
