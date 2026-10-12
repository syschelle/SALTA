import { describe, expect, it } from "vitest";
import { openCcuControlRpcParams, openCcuSetValueWireType } from "./openccu-control-client.js";

describe("OpenCCU v0.8.121 setValue wire types", () => {
  it("maps HomeMatic FLOAT metadata to the OpenCCU XML-RPC double wire type", () => {
    expect(openCcuSetValueWireType("float")).toBe("double");
    expect(openCcuSetValueWireType("FLOAT")).toBe("double");
    expect(openCcuControlRpcParams("Interface.setValue", {
      interface: "BidCos-RF",
      address: "MEQ0004123:2",
      valueKey: "SET_TEMPERATURE",
      type: "float",
      value: 15
    })).toEqual({
      interface: "BidCos-RF",
      address: "MEQ0004123:2",
      valueKey: "SET_TEMPERATURE",
      type: "double",
      value: "15"
    });
  });

  it("preserves the other OpenCCU Interface.setValue wire types", () => {
    expect(openCcuSetValueWireType("double")).toBe("double");
    expect(openCcuSetValueWireType("int")).toBe("int");
    expect(openCcuSetValueWireType("bool")).toBe("bool");
    expect(openCcuSetValueWireType("string")).toBe("string");
  });

  it("does not reinterpret a type field on unrelated OpenCCU methods", () => {
    expect(openCcuControlRpcParams("Interface.getParamset", { type: "float", value: 15 })).toEqual({
      type: "float",
      value: "15"
    });
  });
});
