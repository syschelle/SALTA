import type { AutomationLogger, AutomationStore } from "./automations.js";
import {
  createAutomation,
  deleteAutomation,
  listAutomations,
  markAutomationTriggered,
  updateAutomation,
  writeSystemLog
} from "./db.js";

export const databaseAutomationStore: AutomationStore = {
  list: listAutomations,
  create: createAutomation,
  update: updateAutomation,
  remove: deleteAutomation,
  markTriggered: markAutomationTriggered
};

export const databaseAutomationLogger: AutomationLogger = {
  write: writeSystemLog
};
