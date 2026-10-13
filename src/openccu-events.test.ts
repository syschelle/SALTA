import { describe, expect, it } from "vitest";
import { openCcuContactStateEventValue } from "./openccu-core.js";
import { OPENCCU_CALLBACK_PORT, openCcuButtonEventValue, openCcuXmlRpcEvents, openCcuXmlRpcInitRequest, openCcuXmlRpcInterfacePort } from "./openccu-xmlrpc.js";

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

  it("parses classic HM-Sec-SCo STATE callbacks as immediate contact states", () => {
    const opened = `<?xml version="1.0" encoding="iso-8859-1"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data><value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>NEQ1157537:1</value><value>STATE</value><value><boolean>1</boolean></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`;
    const closed = `<?xml version="1.0" encoding="iso-8859-1"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data><value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>NEQ1157537:1</value><value>STATE</value><value><boolean>0</boolean></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`;
    expect(openCcuXmlRpcEvents(opened, instanceId)).toEqual([
      { channelAddress: "NEQ1157537:1", parameter: "STATE", value: true }
    ]);
    expect(openCcuXmlRpcEvents(closed, instanceId)).toEqual([
      { channelAddress: "NEQ1157537:1", parameter: "STATE", value: false }
    ]);
  });

  it("maps only contact STATE callbacks to the boolean open state", () => {
    expect(openCcuContactStateEventValue("SHUTTER_CONTACT", "STATE", true)).toBe(true);
    expect(openCcuContactStateEventValue("SHUTTER_CONTACT", "STATE", false)).toBe(false);
    expect(openCcuContactStateEventValue("SHUTTER_CONTACT", "LOWBAT", true)).toBeUndefined();
    expect(openCcuContactStateEventValue("KEY", "STATE", true)).toBeUndefined();
  });

  it("rejects unknown typed XML-RPC value markup instead of stripping tags and decoding it", () => {
    const xml = `<?xml version="1.0"?><methodCall><methodName>event</methodName><params><param><value>${instanceId}</value></param><param><value>REQ0862479:2</value></param><param><value>PRESS_SHORT</value></param><param><value><dateTime.iso8601>&lt;script&gt;</dateTime.iso8601></value></param></params></methodCall>`;
    expect(openCcuXmlRpcEvents(xml, instanceId)).toEqual([]);
  });

  it("maps only stable button edges to SALTA event values", () => {
    expect(openCcuButtonEventValue("PRESS_SHORT")).toBe(1002);
    expect(openCcuButtonEventValue("PRESS_LONG")).toBe(1001);
    expect(openCcuButtonEventValue("PRESS_LONG_RELEASE")).toBe(1003);
    expect(openCcuButtonEventValue("PRESS_CONT")).toBeUndefined();
    expect(openCcuButtonEventValue("INSTALL_TEST")).toBeUndefined();
  });

  it("uses HomeMatic init semantics to unregister the same callback URL with an empty interface id", () => {
    const callbackUrl = "http://192.168.178.211:18099/";
    const request = openCcuXmlRpcInitRequest(callbackUrl, "");
    expect(request).toContain(`<param><value><string>${callbackUrl}</string></value></param>`);
    expect(request).toContain("<param><value><string></string></value></param>");
  });

  it("uses the proven BidCos-RF and SALTA callback ports", () => {
    expect(openCcuXmlRpcInterfacePort("BidCos-RF")).toBe(2001);
    expect(OPENCCU_CALLBACK_PORT).toBe(18099);
  });
});
