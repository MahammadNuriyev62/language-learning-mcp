let viewUUID: string | undefined;

export function setViewUUID(uuid: string | undefined) {
  viewUUID = uuid;
}

export function saveWidgetState<T>(state: T): void {
  if (!viewUUID) return;
  try {
    localStorage.setItem(`ll:${viewUUID}`, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save widget state:", err);
  }
}

export function loadWidgetState<T>(): T | null {
  if (!viewUUID) return null;
  try {
    const saved = localStorage.getItem(`ll:${viewUUID}`);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}
