import { describe, expect, it } from "vitest";
import { createHueMdnsQuery, parseHueMdnsResponse } from "./hue-mdns.js";

function dnsName(value: string): Buffer {
  return Buffer.concat([...value.split(".").map(label => Buffer.concat([Buffer.from([Buffer.byteLength(label)]), Buffer.from(label)])), Buffer.from([0])]);
}

function rr(name: string, type: number, data: Buffer): Buffer {
  const fixed = Buffer.alloc(10);
  fixed.writeUInt16BE(type, 0);
  fixed.writeUInt16BE(1, 2);
  fixed.writeUInt32BE(120, 4);
  fixed.writeUInt16BE(data.length, 8);
  return Buffer.concat([dnsName(name), fixed, data]);
}

describe("Hue mDNS discovery", () => {
  it("creates a PTR query for the Hue mDNS service and requests a unicast response", () => {
    const query = createHueMdnsQuery();
    expect(query.toString("latin1")).toContain("_hue");
    expect(query.readUInt16BE(query.length - 4)).toBe(12);
    expect(query.readUInt16BE(query.length - 2)).toBe(0x8001);
  });

  it("extracts a Hue service name and bridge id from an mDNS response", () => {
    const service = "_hue._tcp.local";
    const instance = "Philips Hue - Test._hue._tcp.local";
    const txt = Buffer.from("bridgeid=001788FFFE123456");
    const txtData = Buffer.concat([Buffer.from([txt.length]), txt]);
    const body = Buffer.concat([
      rr(service, 12, dnsName(instance)),
      rr(instance, 16, txtData)
    ]);
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0x8400, 2);
    header.writeUInt16BE(2, 6);
    const parsed = parseHueMdnsResponse(Buffer.concat([header, body]));
    expect(parsed).toEqual({ hue: true, name: "Philips Hue - Test", bridgeId: "001788FFFE123456" });
  });

  it("ignores unrelated mDNS responses", () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(1, 6);
    expect(parseHueMdnsResponse(Buffer.concat([header, rr("_printer._tcp.local", 12, dnsName("Printer._printer._tcp.local"))]))).toEqual({ hue: false });
  });
});
