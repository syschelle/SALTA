import { describe, expect, it } from "vitest";
import { OPENCCU_CALLBACK_PORT, openCcuButtonEventValue, openCcuXmlRpcEvents, openCcuXmlRpcInterfacePort } from "./openccu-xmlrpc.js";

const instanceId = "SALTA-DIAG-1786909260382";

describe("OpenCCU XML-RPC realtime events", () => {
  it("parses the HM-PB-6-WM55 PRESS_SHORT event observed from OpenCCU", () => {
    const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
<methodCall><methodName>system.multicall</methodName>
<params><param><value><array><data><value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>REQ0862479:2</value><value>PRESS_SHORT</value><value><boolean>1</boolean></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`;
    expect(openCcuXmlRpcEvents(xml, instanceId)).toEqual([
      { channelAddress: "REQ0862479:2", parameter: "PRESS_SHORT", value: true }
    ]);
  });

  it("parses multiple ordinary OpenCCU events without treating them as button presses", () => {
    const xml = `<?xml version="1.0"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data>
<value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>PEQ1455690:2</value><value>ACTUAL_TEMPERATURE</value><value><double>24.500000</double></value></data></array></value></member></struct></value>
<value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>PEQ1455690:2</value><value>ACTUAL_HUMIDITY</value><value><double>63.000000</double></value></data></array></value></member></struct></value>
</data></array></value></param></params></methodCall>`;
    expect(openCcuXmlRpcEvents(xml, instanceId)).toEqual([
      { channelAddress: "PEQ1455690:2", parameter: "ACTUAL_TEMPERATURE", value: 24.5 },
      { channelAddress: "PEQ1455690:2", parameter: "ACTUAL_HUMIDITY", value: 63 }
    ]);
  });

  it("maps only stable button edges to SALTA event values", () => {
    expect(openCcuButtonEventValue("PRESS_SHORT")).toBe(1002);
    expect(openCcuButtonEventValue("PRESS_LONG")).toBe(1001);
    expect(openCcuButtonEventValue("PRESS_LONG_RELEASE")).toBe(1003);
    expect(openCcuButtonEventValue("PRESS_CONT")).toBeUndefined();
    expect(openCcuButtonEventValue("INSTALL_TEST")).toBeUndefined();
  });

  it("uses the proven BidCos-RF and SALTA callback ports", () => {
    expect(openCcuXmlRpcInterfacePort("BidCos-RF")).toBe(2001);
    expect(OPENCCU_CALLBACK_PORT).toBe(18099);
  });
});
