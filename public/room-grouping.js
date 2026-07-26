(function registerSaltaRoomGrouping(globalObject) {
  function normalizeRoomKey(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
  }

  function buildRoomLookup(rooms) {
    const byId = new Map();
    const byName = new Map();

    for (const room of rooms ?? []) {
      const idKey = normalizeRoomKey(room?.id);
      if (idKey) byId.set(idKey, room);

      const nameKey = normalizeRoomKey(room?.name);
      if (!nameKey) continue;
      const matches = byName.get(nameKey) ?? [];
      matches.push(room);
      byName.set(nameKey, matches);
    }

    return { byId, byName };
  }

  function resolveAssignedRoom(device, lookup) {
    const idKey = normalizeRoomKey(device?.roomId);
    if (idKey && lookup.byId.has(idKey)) return lookup.byId.get(idKey);

    // Older SALTA records and some adapter refreshes can retain the room name
    // while the UUID is missing or formatted differently. Use the name only
    // when it identifies exactly one configured room.
    const nameKey = normalizeRoomKey(device?.room);
    const nameMatches = nameKey ? lookup.byName.get(nameKey) ?? [] : [];
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
  }

  function groupAssignedDevicesByRoom(rooms, devices) {
    const orderedRooms = Array.isArray(rooms) ? rooms : [];
    const lookup = buildRoomLookup(orderedRooms);
    const grouped = new Map(orderedRooms.map((room) => [room.id, []]));

    for (const device of devices ?? []) {
      const room = resolveAssignedRoom(device, lookup);
      if (!room) continue;
      grouped.get(room.id)?.push(device);
    }

    return orderedRooms
      .map((room) => ({
        id: room.id,
        name: room.name,
        icon: room.icon || "home-outline",
        devices: grouped.get(room.id) ?? [],
      }))
      .filter((group) => group.devices.length > 0);
  }

  globalObject.SaltaRoomGrouping = Object.freeze({
    normalizeRoomKey,
    resolveAssignedRoom,
    groupAssignedDevicesByRoom,
  });
})(globalThis);
