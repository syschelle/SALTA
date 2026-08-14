import { config } from "./config.js";
import { initializeDatabaseSchema, inspectCredentialEncryption, pool, listDevices, writeSystemLog } from "./db.js";
import { DeviceRegistry } from "./registry.js";
import { HomeKitBridge } from "./homekit.js";
import { buildServer } from "./server.js";
import { ShellyAdapter } from "./shelly-adapter.js";
import { PhosconAdapter } from "./phoscon-adapter.js";
import { OpenCcuAdapter } from "./openccu-adapter.js";
import { VirtualDeviceAdapter } from "./virtual-adapter.js";
import { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";
import { DeviceCommandRouter } from "./device-command-router.js";
import { AutomationEngine } from "./automations.js";
import { databaseAutomationLogger, databaseAutomationStore } from "./automation-persistence.js";
import { ClimateModeManager } from "./climate-mode.js";
import { BatteryMonitor } from "./battery-monitor.js";

async function main(): Promise<void> {
  await initializeDatabaseSchema();
  const registry = new DeviceRegistry();
  for (const device of await listDevices()) registry.hydrate(device);

  const shelly = new ShellyAdapter(registry);
  const phoscon = new PhosconAdapter(registry);
  const openCcu = new OpenCcuAdapter(registry);
  const virtual = new VirtualDeviceAdapter(registry);
  const presence = new FritzBoxPresenceAdapter(registry);
  const commands = new DeviceCommandRouter(registry, { shelly, phoscon, openccu: openCcu, virtual });
  const automations = new AutomationEngine(registry, commands, databaseAutomationStore, databaseAutomationLogger);
  await automations.start();
  const climate = new ClimateModeManager(registry, commands);
  const batteryMonitor = new BatteryMonitor(registry);

  shelly.start();
  phoscon.start();
  openCcu.start();
  presence.start();
  batteryMonitor.start();
  climate.start();

  const homekit = new HomeKitBridge(registry, commands);
  homekit.start();

  const server = buildServer(registry, shelly, phoscon, openCcu, virtual, commands, automations, presence, climate, batteryMonitor, () => process.kill(process.pid, "SIGTERM"));
  await server.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
  server.log.info({ port: config.WEB_PORT, homekit: config.HOMEKIT_ENABLED, trustedProxiesConfigured: Boolean(config.TRUSTED_PROXIES.trim()) }, "SALTA started with mandatory authentication");
  await writeSystemLog("info", "system", "SALTA_STARTED", "SALTA started", { port: config.WEB_PORT, homekit: config.HOMEKIT_ENABLED }).catch(() => undefined);
  const credentialEncryption = await inspectCredentialEncryption();
  if (credentialEncryption.status === "invalid") {
    server.log.error({
      globalCredential: credentialEncryption.globalCredential,
      phosconCredential: credentialEncryption.phosconCredential,
      openCcuCredential: credentialEncryption.openCcuCredential,
      pushoverCredential: credentialEncryption.pushoverCredential,
      invalidDeviceCredentials: credentialEncryption.invalidDeviceIds.length
    }, "Stored credentials cannot be decrypted with the current SALTA_ENCRYPTION_KEY");
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.log.info({ signal }, "Shutting down SALTA");
    await writeSystemLog("info", "system", "SALTA_STOPPING", "SALTA is shutting down", { signal }).catch(() => undefined);
    await server.close();
    homekit.stop();
    automations.stop();
    climate.stop();
    batteryMonitor.stop();
    presence.stop();
    await openCcu.stop();
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
