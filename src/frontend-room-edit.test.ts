import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("room editor live refresh regression", () => {
  it("refreshes only live device data on the five-second polling interval", () => {
    expect(source).toContain("setInterval(refreshLiveData,5000)");
    expect(source).not.toContain("setInterval(load,5000)");

    const refreshFunction = source.match(/async function refreshLiveData\(\)\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(refreshFunction).toContain("all=await api('/api/devices')");
    expect(refreshFunction).not.toContain("renderRooms()");
  });

  it("tracks and restores the active room edit state", () => {
    expect(source).toContain("editingRoomId=id");
    expect(source).toContain("const draft=currentRoomEditDraft()");
    expect(source).toContain("restoreRoomEdit(draft,{focus:Boolean(draft.activeField)})");
    expect(source).toContain("if(editingRoomId===id)editingRoomId=null");
  });
});
