export function appendChekiPickerSelection(
  selectedIds: string[],
  visibleIds: string[],
  maxSelection: number,
): string[] {
  const next = [...selectedIds.slice(0, maxSelection)];
  const selected = new Set(next);
  for (const id of visibleIds) {
    if (next.length >= maxSelection) break;
    if (selected.has(id)) continue;
    selected.add(id);
    next.push(id);
  }
  return next;
}

export function removeChekiPickerSelection(
  selectedIds: string[],
  visibleIds: string[],
): string[] {
  const visible = new Set(visibleIds);
  return selectedIds.filter((id) => !visible.has(id));
}
