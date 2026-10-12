import { describe, expect, it } from "vitest";
import { OPENCCU_DUTY_CYCLE_FRONTEND, parseOpenCcuDutyCycleResult } from "./openccu-duty-cycle.js";

describe("OpenCCU Duty Cycle", () => {
  it("parses the official Interface.getDutyCycle array result", () => {
    expect(parseOpenCcuDutyCycleResult([
      { sysvar: "DutyCycle-CCU", address: "ABC", dutyCycle: 12, carrierSense: 4, type: "CCU3" },
      { sysvar: "DutyCycle-LAN", address: "DEF", dutyCycle: 73, type: "LAN" }
    ])).toEqual([
      { dutyCycle: 12, carrierSense: 4, type: "CCU3", name: "DutyCycle-CCU" },
      { dutyCycle: 73, type: "LAN", name: "DutyCycle-LAN" }
    ]);
  });

  it("also accepts the JSON-string response returned by OpenCCU", () => {
    expect(parseOpenCcuDutyCycleResult('[{"dutyCycle":42,"type":"CCU3"}]')).toEqual([
      { dutyCycle: 42, type: "CCU3" }
    ]);
  });

  it("adds a sixth overview statistic and colors the percentage at 4/10 percent thresholds", () => {
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain("overviewDutyCycleCard");
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain("repeat(6,minmax(0,1fr))");
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain("duty>10?'alarm':duty>4?'warning':'ok'");
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain(".overview-duty-cycle-stat.warning strong{color:#9a7600}");
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain("html[data-theme=\"dark\"] .overview-duty-cycle-stat.warning strong{color:#ffd54f}");
    expect(OPENCCU_DUTY_CYCLE_FRONTEND).toContain("/api/openccu/duty-cycle");
  });
});
