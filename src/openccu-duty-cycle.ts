import type { FastifyInstance } from "fastify";
import { getOpenCcuConnection, writeSystemLog } from "./db.js";
import { record } from "./openccu-core.js";
import type { OpenCcuControlTransport } from "./openccu-control-client.js";

const pollIntervalMs = 60_000;

export interface OpenCcuDutyCycleEntry {
  dutyCycle: number;
  carrierSense?: number;
  type?: string;
  name?: string;
}

export interface OpenCcuDutyCycleStatus {
  available: boolean;
  maxDutyCycle?: number;
  interfaces: OpenCcuDutyCycleEntry[];
  lastUpdated?: string;
  lastError?: string;
}

function percentage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.floor(parsed) : undefined;
}

export function parseOpenCcuDutyCycleResult(input: unknown): OpenCcuDutyCycleEntry[] {
  let value = input;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new Error("OPENCCU_DUTY_CYCLE_INVALID_RESPONSE");
    }
  }
  if (!Array.isArray(value)) throw new Error("OPENCCU_DUTY_CYCLE_INVALID_RESPONSE");
  return value.flatMap(item => {
    const entry = record(item);
    const dutyCycle = percentage(entry.dutyCycle);
    if (dutyCycle === undefined) return [];
    const carrierSense = percentage(entry.carrierSense);
    const type = String(entry.type ?? "").trim() || undefined;
    const name = String(entry.name ?? entry.sysvar ?? "").trim() || undefined;
    return [{
      dutyCycle,
      ...(carrierSense !== undefined ? { carrierSense } : {}),
      ...(type ? { type } : {}),
      ...(name ? { name } : {})
    }];
  });
}

export class OpenCcuDutyCycleMonitor {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private refreshTask?: Promise<void>;
  private lastLoggedError = "";
  private current: OpenCcuDutyCycleStatus = { available: false, interfaces: [] };

  constructor(private readonly client: OpenCcuControlTransport) {}

  getStatus(): OpenCcuDutyCycleStatus {
    return {
      ...this.current,
      interfaces: this.current.interfaces.map(entry => ({ ...entry }))
    };
  }

  private schedule(delayMs: number): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh().finally(() => this.schedule(pollIntervalMs));
    }, delayMs);
    this.timer.unref?.();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  async refresh(): Promise<void> {
    if (this.refreshTask) return this.refreshTask;
    const task = (async () => {
      const connection = await getOpenCcuConnection();
      if (!connection.baseUrl || !connection.username || !connection.password) {
        this.current = { available: false, interfaces: [], lastError: "OPENCCU_NOT_CONFIGURED" };
        return;
      }
      try {
        const result = await this.client.call(connection, "Interface.getDutyCycle");
        const interfaces = parseOpenCcuDutyCycleResult(result);
        const maxDutyCycle = interfaces.length ? Math.max(...interfaces.map(entry => entry.dutyCycle)) : undefined;
        this.current = {
          available: maxDutyCycle !== undefined,
          ...(maxDutyCycle !== undefined ? { maxDutyCycle } : {}),
          interfaces,
          lastUpdated: new Date().toISOString()
        };
        if (this.lastLoggedError) {
          await writeSystemLog("info", "openccu", "OPENCCU_DUTY_CYCLE_RECOVERED", "OpenCCU Duty Cycle status is available again", {
            interfaces: interfaces.length,
            maxDutyCycle
          }).catch(() => undefined);
          this.lastLoggedError = "";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.current = {
          available: false,
          interfaces: [],
          lastError: message,
          lastUpdated: new Date().toISOString()
        };
        if (message !== this.lastLoggedError) {
          await writeSystemLog("warning", "openccu", "OPENCCU_DUTY_CYCLE_FAILED", "OpenCCU Duty Cycle status could not be read", {
            error: message
          }).catch(() => undefined);
          this.lastLoggedError = message;
        }
      }
    })().finally(() => {
      if (this.refreshTask === task) this.refreshTask = undefined;
    });
    this.refreshTask = task;
    return task;
  }
}

export const OPENCCU_DUTY_CYCLE_FRONTEND = `(() => {
  const styleId='openccu-duty-cycle-style';
  const cardId='overviewDutyCycleCard';
  const valueId='overviewDutyCycle';
  const detailId='overviewDutyCycleDetail';
  function ensureStyle(){
    if(document.getElementById(styleId))return;
    const style=document.createElement('style');
    style.id=styleId;
    style.textContent='@media (min-width:901px){.overview-stats{grid-template-columns:repeat(6,minmax(0,1fr))}}.overview-duty-cycle-stat.ok strong{color:var(--green)}.overview-duty-cycle-stat.warning strong{color:var(--accent)}.overview-duty-cycle-stat.alarm strong{color:var(--state-off-accent)}';
    document.head.appendChild(style);
  }
  function ensureCard(){
    const stats=document.querySelector('.overview-stats');
    if(!stats)return null;
    let card=document.getElementById(cardId);
    if(card)return card;
    card=document.createElement('article');
    card.id=cardId;
    card.className='overview-duty-cycle-stat';
    card.innerHTML='<span>Duty Cycle</span><strong id="'+valueId+'">–</strong><small id="'+detailId+'">OpenCCU</small>';
    const presence=document.getElementById('overviewPresenceCard');
    if(presence)stats.insertBefore(card,presence);else stats.appendChild(card);
    ensureStyle();
    return card;
  }
  function render(data){
    const card=ensureCard();
    if(!card)return;
    const value=document.getElementById(valueId);
    const detail=document.getElementById(detailId);
    card.classList.remove('ok','warning','alarm');
    const duty=Number(data?.maxDutyCycle);
    if(!data?.available||!Number.isFinite(duty)){
      value.textContent='–';
      detail.textContent='OpenCCU';
      return;
    }
    value.textContent=Math.round(duty)+' %';
    detail.textContent='OpenCCU';
    card.classList.add(duty>=90?'alarm':duty>=70?'warning':'ok');
  }
  async function refresh(){
    if(!ensureCard())return;
    try{
      const response=await fetch('/api/openccu/duty-cycle',{headers:{accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      render(await response.json());
    }catch{render({available:false});}
  }
  function start(){
    if(!document.querySelector('.overview-stats'))return;
    void refresh();
    const timer=setInterval(()=>void refresh(),60000);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();`;

export function registerOpenCcuDutyCycleRoutes(server: FastifyInstance, monitor: OpenCcuDutyCycleMonitor): void {
  server.get("/api/openccu/duty-cycle", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return monitor.getStatus();
  });
  server.get("/openccu-duty-cycle.js", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.type("application/javascript; charset=utf-8");
    return OPENCCU_DUTY_CYCLE_FRONTEND;
  });
}
