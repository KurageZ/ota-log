import type {
  ChekiWidgetFilterRules,
  ChekiWidgetGroupSource,
  ChekiWidgetSlot,
} from '../types/chekiWidgetGroups';

export interface ChekiWidgetGroupDraft {
  slot: ChekiWidgetSlot;
  name: string;
  source: ChekiWidgetGroupSource;
}

const drafts = new Map<ChekiWidgetSlot, ChekiWidgetGroupDraft>();
const listeners = new Map<ChekiWidgetSlot, Set<() => void>>();

function notify(slot: ChekiWidgetSlot): void {
  listeners.get(slot)?.forEach((listener) => listener());
}

function cloneRules(rules: ChekiWidgetFilterRules): ChekiWidgetFilterRules {
  return {
    ...rules,
    artistIds: [...rules.artistIds],
    eventIds: [...rules.eventIds],
    specs: [...rules.specs],
    date: rules.date && rules.date.preset === 'custom' ? { ...rules.date } : rules.date,
  };
}

export function cloneChekiWidgetSource(source: ChekiWidgetGroupSource): ChekiWidgetGroupSource {
  return source.type === 'manual'
    ? { type: 'manual', itemIds: [...source.itemIds] }
    : { type: 'filter', rules: cloneRules(source.rules) };
}

export function getChekiWidgetGroupDraft(slot: ChekiWidgetSlot): ChekiWidgetGroupDraft | null {
  const draft = drafts.get(slot);
  return draft ? { ...draft, source: cloneChekiWidgetSource(draft.source) } : null;
}

export function setChekiWidgetGroupDraft(draft: ChekiWidgetGroupDraft): void {
  drafts.set(draft.slot, { ...draft, source: cloneChekiWidgetSource(draft.source) });
  notify(draft.slot);
}

export function clearChekiWidgetGroupDraft(slot: ChekiWidgetSlot): void {
  drafts.delete(slot);
  notify(slot);
}

export function subscribeChekiWidgetGroupDraft(slot: ChekiWidgetSlot, listener: () => void): () => void {
  const slotListeners = listeners.get(slot) ?? new Set<() => void>();
  slotListeners.add(listener);
  listeners.set(slot, slotListeners);
  return () => {
    slotListeners.delete(listener);
    if (slotListeners.size === 0) listeners.delete(slot);
  };
}
