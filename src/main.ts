import { config } from "./config.js";
import { inspectCredentialEncryption, migrate, pool, listDevices, upgradeCredentialEncryption } from "./db.js";
import { DeviceRegistry } from "./registry.js";
import { HomeKitBridge } from "./homekit.js";
import { buildServer } from "./server.js";
import { ShellyAdapter } from "./shelly-adapter.js";

async function main(): Promise<void> {
  await migrate();
  await upgradeCredentialEncryption();
  const registry = new DeviceRegistry();
  for (const device of await listDevices()) await registry.set(device);

  const shelly = new ShellyAdapter(registry);
  shelly.start();

  const homekit = new HomeKitBridge(registry, shelly);
  homekit.start();

  const server = buildServer(registry, shelly);
  await server.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
  server.log.info({ port: config.WEB_PORT, homekit: config.HOMEKIT_ENABLED, trustedProxiesConfigured: Boolean(config.TRUSTED_PROXIES.trim()) }, "SALTA started with mandatory authentication");
  const credentialEncryption = await inspectCredentialEncryption();
  if (credentialEncryption.status === "invalid") {
    server.log.error({
      globalCredential: credentialEncryption.globalCredential,
      invalidDeviceCredentials: credentialEncryption.invalidDeviceIds.length
    }, "Stored credentials cannot be decrypted with the current SALTA_ENCRYPTION_KEY");
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.log.info({ signal }, "Shutting down SALTA");
    await server.close();
    homekit.stop();
    shelly.stop();
    await pool.end();
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
