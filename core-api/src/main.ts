import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const server = createServer();

server.listen(port, () => {
  // Placeholder bootstrap for the modular core service.
  console.log(`[core-api] listening on port ${port}`);
});
