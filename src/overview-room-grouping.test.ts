import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Room = { id: string; name: string; icon?: string };
type Device = { id: string; roomId?: string; room?: string };
type RoomGroup = Room & { devices: Device[] };
type RoomGroupingApi = {
  groupAssignedDevicesByRoom(rooms: Room[], devices: Device[]): RoomGroup[];
};

await import(new URL("../public/room-grouping.js", import.meta.url).href);
const roomGrouping = (globalThis as typeof globalThis & { SaltaRoomGrouping: RoomGroupingApi }).SaltaRoomGrouping;

const rooms: Room[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Wohnzimmer", icon: "sofa-outline" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Büro", icon: "desk" },
];

describe("overview room grouping", () => {
  it("groups devices by normalized room UUID and keeps configured room order", () => {
    const groups = roomGrouping.groupAssignedDevicesByRoom(rooms, [
      { id: "office", roomId: " 22222222-2222-4222-8222-222222222222 " },
      { id: "living", roomId: "11111111-1111-4111-8111-111111111111" },
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Wohnzimmer", "Büro"]);
    expect(groups[0]?.devices.map((device) => device.id)).toEqual(["living"]);
    expect(groups[1]?.devices.map((device) => device.id)).toEqual(["office"]);
  });

  it("recovers a unique legacy room-name assignment", () => {
    const groups = roomGrouping.groupAssignedDevicesByRoom(rooms, [
      { id: "legacy", room: " wohnzimmer " },
      { id: "stale-id", roomId: "deleted-room", room: "BÜRO" },
    ]);

    expect(groups[0]?.devices.map((device) => device.id)).toEqual(["legacy"]);
    expect(groups[1]?.devices.map((device) => device.id)).toEqual(["stale-id"]);
  });

  it("never displays unassigned, stale or ambiguous devices on the overview", () => {
    const duplicateRooms = [...rooms, { id: "33333333-3333-4333-8333-333333333333", name: "Büro" }];
    const groups = roomGrouping.groupAssignedDevicesByRoom(duplicateRooms, [
      { id: "unassigned" },
      { id: "unknown-id", roomId: "does-not-exist" },
      { id: "unknown-name", room: "Keller" },
      { id: "ambiguous-name", room: "Büro" },
    ]);

    expect(groups).toEqual([]);
  });
});

it("loads the grouping helper before the main browser application", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  expect(html.indexOf('<script src="/room-grouping.js"></script>')).toBeGreaterThan(-1);
  expect(html.indexOf('<script src="/room-grouping.js"></script>')).toBeLessThan(html.indexOf('<script src="/app.js"></script>'));
});
