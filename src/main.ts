import { config } from "./config.js";
import { migrate, pool, listDevices } from "./db.js";
import { DeviceRegistry } from "./registry.js";
import { MockAdapter } from "./mock-adapter.js";
import { HomeKitBridge } from "./homekit.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  await migrate();
  const registry = new DeviceRegistry();
  for (const device of await listDevices()) await registry.set(device);

  const adapter = new MockAdapter(registry, config.MOCK_EVENT_INTERVAL_MS);
  await adapter.start();

  const homekit = new HomeKitBridge(registry, adapter);
  homekit.start();

  const server = buildServer(registry, adapter);
  await server.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
  server.log.info({ port: config.WEB_PORT, homekit: config.HOMEKIT_ENABLED }, "SALTA started");
  if (!config.ADMIN_PASSWORD) server.log.warn("ADMIN_PASSWORD is empty; web authentication is disabled");

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.log.info({ signal }, "Shutting down SALTA");
    await server.close();
    homekit.stop();
    await adapter.stop();
    await pool.end();
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
