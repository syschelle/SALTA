import { config } from "./config.js";
import { initializeDatabaseSchema, inspectCredentialEncryption, pool, listDevices } from "./db.js";
import { DeviceRegistry } from "./registry.js";
import { HomeKitBridge } from "./homekit.js";
import { buildServer } from "./server.js";
import { ShellyAdapter } from "./shelly-adapter.js";
import { PhosconAdapter } from "./phoscon-adapter.js";

async function main(): Promise<void> {
  await initializeDatabaseSchema();
  const registry = new DeviceRegistry();
  for (const device of await listDevices()) registry.hydrate(device);

  const shelly = new ShellyAdapter(registry);
  shelly.start();

  const phoscon = new PhosconAdapter(registry);
  phoscon.start();

  const homekit = new HomeKitBridge(registry, shelly);
  homekit.start();

  const server = buildServer(registry, shelly, phoscon);
  await server.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
  server.log.info({ port: config.WEB_PORT, homekit: config.HOMEKIT_ENABLED, trustedProxiesConfigured: Boolean(config.TRUSTED_PROXIES.trim()) }, "SALTA started with mandatory authentication");
  const credentialEncryption = await inspectCredentialEncryption();
  if (credentialEncryption.status === "invalid") {
    server.log.error({
      globalCredential: credentialEncryption.globalCredential,
      phosconCredential: credentialEncryption.phosconCredential,
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
    phoscon.stop();
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
