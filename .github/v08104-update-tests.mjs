import { readFileSync, writeFileSync } from "node:fs";

const path = "src/openccu-core.test.ts";
let source = readFileSync(path, "utf8");

const replacements = [
  [
    'targetTemperatureParameter: "SET_POINT_TEMPERATURE",\n        modeParameter: "SET_POINT_MODE",\n        modeValueType: "int",\n        modeAutoValue: 0,\n        modeManualValue: 1',
    'targetTemperatureParameter: "SET_POINT_TEMPERATURE",\n        modeParameter: "CONTROL_MODE",\n        modeValueType: "int",\n        modeAutoValue: 0,\n        modeManualValue: 1'
  ],
  [
    'modeParameter: "SET_POINT_MODE",\n        modeValueType: "int",\n        modeAutoValue: 0,\n        modeManualValue: 1,\n        thermostatModeInferred: true',
    'modeParameter: "CONTROL_MODE",\n        modeValueType: "int",\n        modeAutoValue: 0,\n        modeManualValue: 1'
  ],
  [
    'writes: [{ parameter: "SET_POINT_MODE", valueType: "int", value: 0 }],\n      state: { controlMode: "auto" }\n    });\n    expect(openCcuThermostatModePlan({\n      interfaceName: "BidCos-RF"',
    'writes: [{ parameter: "CONTROL_MODE", valueType: "int", value: 0 }],\n      state: { controlMode: "auto" }\n    });\n    expect(openCcuThermostatModePlan({\n      interfaceName: "BidCos-RF"'
  ]
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected legacy test fragment not found: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

writeFileSync(path, source);
