import type { EventLiveActivityProps } from './types';

export const EVENT_LIVE_ACTIVITY_PAYLOAD_LIMIT_BYTES = 4_096;

export function compactLiveActivityText(value: string | null | undefined, limit = 64): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const characters = Array.from(normalized);
  if (characters.length <= limit) return normalized;
  return `${characters.slice(0, Math.max(1, limit - 1)).join('')}…`;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function eventLiveActivityPayloadByteLength(props: EventLiveActivityProps): number {
  return utf8ByteLength(JSON.stringify({
    name: 'EventLiveActivity',
    props: JSON.stringify(props),
  }));
}

export function assertEventLiveActivityPayloadFits(props: EventLiveActivityProps): void {
  const byteLength = eventLiveActivityPayloadByteLength(props);
  if (byteLength >= EVENT_LIVE_ACTIVITY_PAYLOAD_LIMIT_BYTES) {
    throw new Error(`Event Live Activity payload is ${byteLength} bytes; maximum is 4095 bytes`);
  }
}
