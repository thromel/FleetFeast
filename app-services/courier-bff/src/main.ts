import { createCourierBffServerFromEnv } from "./server.js";

const port = Number(process.env.PORT ?? 4102);
const app = createCourierBffServerFromEnv();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`[courier-bff] listening on port ${port}`);
});
