import type { Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { getPushoverConnection, getPushoverSettings, getVacationModeSettings, updateVacationModeSettings, writeSystemLog } from "./db.js";
import { sendPushoverMessage, type PushoverSender } from "./pushover.js";

export const VACATION_MODE_AUTOMATION_DEVICE_ID = "system:vacation-mode";

export interface VacationModeStatus {
  enabled: boolean;
  contactSensors: number;
  openContacts: number;
  pushoverConfigured: boolean;
}

type VacationRegistry = Pick<DeviceRegistry, "all" | "get" | "set" | "on" | "off">;

function isContactSensor(device: Device): boolean {
  return device.type === "contactSensor" && typeof device.state.open === "boolean";
}

function alertMessage(device: Device, at: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(at);
  return [
    `Kontakt geöffnet: ${device.name}`,
    device.room ? `Raum: ${device.room}` : "Raum: nicht zugeordnet",
    `Zeit: ${time}`
  ].join("\n");
}

export class VacationModeManager {
  private enabled = false;
  private started = false;
  private readonly contactState = new Map<string, boolean>();

  private readonly onDevice = (device: Device): void => {
    void this.handleDevice(device).catch(error => {
      void writeSystemLog("error", "system", "VACATION_MONITOR_ERROR", "Vacation mode security monitor failed while processing a device update", {
        deviceId: device.id,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => undefined);
    });
  };

  constructor(
    private readonly registry: VacationRegistry,
    private readonly timeZone: string,
    private readonly sender: PushoverSender = sendPushoverMessage
  ) {}

  async initialize(): Promise<void> {
    this.enabled = (await getVacationModeSettings()).enabled;
    await this.syncAutomationDevice();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.contactState.clear();
    for (const device of this.registry.all()) {
      if (isContactSensor(device)) this.contactState.set(device.id, device.state.open === true);
    }
    this.registry.on("device", this.onDevice);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.registry.off("device", this.onDevice);
    this.contactState.clear();
  }

  private contactCounts(): { contactSensors: number; openContacts: number } {
    const contacts = this.registry.all().filter(isContactSensor);
    return {
      contactSensors: contacts.length,
      openContacts: contacts.filter(device => device.reachable && device.state.open === true).length
    };
  }

  async status(): Promise<VacationModeStatus> {
    const pushover = await getPushoverSettings();
    return {
      enabled: this.enabled,
      ...this.contactCounts(),
      pushoverConfigured: pushover.userKeyConfigured && pushover.apiTokenConfigured && pushover.encryptionStatus === "ok"
    };
  }

  async setEnabled(enabled: boolean): Promise<VacationModeStatus> {
    await updateVacationModeSettings(enabled);
    this.enabled = enabled;
    await this.syncAutomationDevice();
    await writeSystemLog(
      "info",
      "system",
      enabled ? "VACATION_MODE_ENABLED" : "VACATION_MODE_DISABLED",
      enabled ? "Vacation mode enabled" : "Vacation mode disabled",
      this.contactCounts()
    ).catch(() => undefined);
    return this.status();
  }

  private async syncAutomationDevice(): Promise<void> {
    const stamp = new Date().toISOString();
    const current = this.registry.get(VACATION_MODE_AUTOMATION_DEVICE_ID);
    await this.registry.set({
      id: VACATION_MODE_AUTOMATION_DEVICE_ID,
      source: "system",
      sourceId: "vacation-mode",
      type: "genericSensor",
      presentationType: "auto",
      name: "Urlaubsmodus",
      reachable: true,
      state: { ...(current?.state ?? {}), vacationActive: this.enabled },
      capabilities: [],
      homekitEnabled: false,
      hidden: true,
      credentialMode: "none",
      passwordConfigured: false,
      lastSeen: stamp,
      lastEvent: stamp,
      adapterData: { ...(current?.adapterData ?? {}), systemKind: "vacationMode" }
    });
  }

  private async handleDevice(device: Device): Promise<void> {
    if (!isContactSensor(device)) return;
    const currentOpen = device.state.open === true;
    const previousOpen = this.contactState.get(device.id);
    this.contactState.set(device.id, currentOpen);
    if (!this.enabled || previousOpen !== false || !currentOpen || !device.reachable) return;

    const at = new Date();
    try {
      const pushover = await getPushoverConnection();
      if (!pushover.userKey || !pushover.apiToken) {
        await writeSystemLog("warning", "notification", "VACATION_ALERT_PUSHOVER_NOT_CONFIGURED", "Vacation contact alert could not be sent because Pushover is not configured", {
          deviceId: device.id,
          deviceName: device.name,
          room: device.room ?? null
        }).catch(() => undefined);
        return;
      }
      await this.sender({
        userKey: pushover.userKey,
        apiToken: pushover.apiToken,
        title: "SALTA Urlaubsmodus: Kontakt geöffnet",
        message: alertMessage(device, at, this.timeZone)
      });
      await writeSystemLog("warning", "notification", "VACATION_CONTACT_ALERT_SENT", "Vacation mode contact alert sent via Pushover", {
        deviceId: device.id,
        deviceName: device.name,
        room: device.room ?? null,
        openedAt: at.toISOString()
      }).catch(() => undefined);
    } catch (error) {
      await writeSystemLog("error", "notification", "PUSHOVER_VACATION_ALERT_FAILED", "Vacation mode contact alert could not be sent", {
        deviceId: device.id,
        deviceName: device.name,
        room: device.room ?? null,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => undefined);
    }
  }
}
