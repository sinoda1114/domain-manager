/** Keep a selected target id only while it remains in the visible (filtered) options. */
export function visibleTargetId(selectedId: string, visibleIds: readonly string[]): string {
  if (!selectedId) return "";
  return visibleIds.includes(selectedId) ? selectedId : "";
}
