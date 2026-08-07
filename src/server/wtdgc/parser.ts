import type { WtdgcSnapshotRaw } from "./types";

export function parseWtdgcCallbackPayload(input: string): WtdgcSnapshotRaw {
  const trimmed = input.trim();

  // Direct JSON export.
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as WtdgcSnapshotRaw;
  }

  // Google Apps Script callback response copied from DevTools. The useful
  // payload is an escaped JSON string embedded in an op.exec envelope.
  const marker = '[["op.exec",[0,"';
  const start = trimmed.indexOf(marker);
  if (start === -1) {
    throw new Error("Unsupported WTDGC callback payload");
  }

  const payloadStart = start + marker.length;
  const tailMarker = '"]],["di"';
  const end = trimmed.lastIndexOf(tailMarker);
  if (end === -1 || end <= payloadStart) {
    throw new Error("Could not locate WTDGC callback JSON payload");
  }

  const escapedJson = trimmed.slice(payloadStart, end);
  const jsonText = JSON.parse(`"${escapedJson}"`) as string;
  const parsed = JSON.parse(jsonText) as WtdgcSnapshotRaw;

  if (!Array.isArray(parsed.summary) || !parsed.details || typeof parsed.details !== "object") {
    throw new Error("Invalid WTDGC snapshot structure");
  }

  return parsed;
}
