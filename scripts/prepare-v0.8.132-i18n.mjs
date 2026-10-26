import { readFileSync, writeFileSync } from "node:fs";

const path = "public/i18n/de.json";
const de = JSON.parse(readFileSync(path, "utf8"));
de.phrases ??= {};
for (const key of [
  "FRITZ!Box Smart Home",
  "Optional. Ohne Aktivierung werden keine Smart-Home-Geräte abgefragt oder angelegt.",
  "Deaktiviert – keine FRITZ!Box-Smart-Home-Geräte werden abgefragt.",
  "Smart-Home-Geräte einbinden",
  "Getrennt von der Präsenzerkennung und standardmäßig deaktiviert.",
  "Heizkörperregler",
  "Temperatur und Solltemperatur",
  "Steckdosen / Schalter",
  "Schaltzustand und Steuerung",
  "Leuchten",
  "Ein/Aus und Helligkeit, soweit unterstützt",
  "Sensoren",
  "Temperatur und Luftfeuchte, soweit verfügbar",
  "FRITZ!Box Smart Home gespeichert.",
  "FRITZ!Box Smart Home verbunden.",
  "FRITZ!Box Smart Home konnte nicht verbunden werden.",
  "FRITZ!Box Smart Home synchronisiert.",
  "Geräte eingebunden",
  "Nicht verbunden",
  "Noch nicht synchronisiert"
]) de.phrases[key] = key;
writeFileSync(path, `${JSON.stringify(de, null, 2)}\n`, "utf8");
