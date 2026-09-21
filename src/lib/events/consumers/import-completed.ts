import "server-only";

export async function onImportCompleted(_payload: {
  target: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}) {
  // Reserved for notifications, dashboards, etc.
}
