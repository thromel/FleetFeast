import { createOpsBffServerFromEnv } from "./server.js";
const port = Number(process.env.PORT ?? 4103);
const app = createOpsBffServerFromEnv();
app.listen({ port, host: "0.0.0.0" }).then(() => {
    console.log(`[ops-bff] listening on port ${port}`);
});
//# sourceMappingURL=main.js.map