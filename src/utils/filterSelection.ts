export function toggleBatchSelection(selectedIds: string[], batchIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const allSelected = batchIds.length > 0 && batchIds.every((id) => selected.has(id));
  for (const id of batchIds) {
    if (allSelected) selected.delete(id);
    else selected.add(id);
  }
  return [...selected];
}
