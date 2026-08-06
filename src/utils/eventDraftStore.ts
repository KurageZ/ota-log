import type { EventFormPrefill } from '../components/EventForm';

export interface EventDraft {
  prefill: EventFormPrefill | null;
  photoUris: string[];
  showPrefillNotice: boolean;
}

let draft: EventDraft | null = null;

export function setEventDraft(next: EventDraft | null) {
  draft = next;
}

export function consumeEventDraft(): EventDraft | null {
  const current = draft;
  draft = null;
  return current;
}
