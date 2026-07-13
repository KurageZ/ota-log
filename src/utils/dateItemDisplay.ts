import { Artist, DateItem } from '../types/models';
import { getArtistPrimaryName } from './artistDisplay';

export type DateItemPresetKind = 'firstCheki' | 'firstLive' | null;

export function getDateItemPresetKind(item: DateItem): DateItemPresetKind {
  if (item.source_kind === 'first_cheki') return 'firstCheki';
  if (item.source_kind === 'first_live') return 'firstLive';
  return null;
}

export function getPresetDateItemTitle(kind: Exclude<DateItemPresetKind, null>, artist: Artist): string {
  const name = getArtistPrimaryName(artist);
  return kind === 'firstCheki'
    ? `与 ${name} 首次拍立得`
    : `首次观看 ${name} 的演出`;
}
