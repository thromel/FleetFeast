import { spawn } from "node:child_process";

const rootCwd = process.cwd();

function startProcess(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: rootCwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(`[dev-web-stack] ${name} exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
    }
  });

  return child;
}

const processes = [
  startProcess("core-api", "npm", ["--prefix", "core-api", "run", "dev"], {
    PORT: "3000"
  }),
  startProcess("consumer-bff", "npm", ["--workspace", "@fleetfeast/consumer-bff", "run", "start"], {
    CORE_API_BASE_URL: "http://127.0.0.1:3000",
    PORT: "4101"
  }),
  startProcess("courier-bff", "npm", ["--workspace", "@fleetfeast/courier-bff", "run", "start"], {
    CORE_API_BASE_URL: "http://127.0.0.1:3000",
    PORT: "4102"
  }),
  startProcess("ops-bff", "npm", ["--workspace", "@fleetfeast/ops-bff", "run", "start"], {
    CORE_API_BASE_URL: "http://127.0.0.1:3000",
    PORT: "4103"
  }),
  startProcess("realtime-gateway", "npm", ["--workspace", "@fleetfeast/realtime-gateway", "run", "start"], {
    PORT: "4104"
  }),
  startProcess("web-merchant", "npm", ["--workspace", "@fleetfeast/web-merchant", "run", "dev"], {
    OPS_BFF_BASE_URL: "http://127.0.0.1:4103"
  }),
  startProcess("web-admin", "npm", ["--workspace", "@fleetfeast/web-admin", "run", "dev"], {
    OPS_BFF_BASE_URL: "http://127.0.0.1:4103"
  })
];

const shutdown = () => {
  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
