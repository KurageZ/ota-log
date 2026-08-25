import { getChekiSpecLabel } from '../domain/chekiSpec';
import type { ChekiWidgetFilterRules } from '../types/chekiWidgetGroups';

export function createEmptyChekiWidgetFilterRules(): ChekiWidgetFilterRules {
  return {
    artistIds: [],
    eventIds: [],
    favoriteOnly: false,
    date: null,
    specs: [],
  };
}

export function countChekiWidgetFilterCategories(rules: ChekiWidgetFilterRules): number {
  return Number(rules.artistIds.length > 0)
    + Number(rules.eventIds.length > 0)
    + Number(rules.favoriteOnly)
    + Number(rules.date !== null)
    + Number(rules.specs.length > 0);
}

function summarizeNames(ids: string[], names: Map<string, string>, suffix: string): string | null {
  if (ids.length === 0) return null;
  const first = names.get(ids[0]);
  if (!first) return ids.length === 1 ? suffix : `${ids.length} 个${suffix}`;
  return ids.length === 1 ? first : `${first}等 ${ids.length} 个${suffix}`;
}

export function describeChekiWidgetFilterRules(
  rules: ChekiWidgetFilterRules,
  artistNames: Map<string, string>,
  eventNames: Map<string, string>,
): string {
  const parts: string[] = [];
  if (rules.date?.preset === 'current_month') parts.push('本月');
  if (rules.date?.preset === 'current_year') parts.push('今年');
  if (rules.date?.preset === 'custom') parts.push(`${rules.date.startDate} – ${rules.date.endDate}`);
  if (rules.favoriteOnly) parts.push('已收藏');

  const artists = summarizeNames(rules.artistIds, artistNames, '艺人');
  if (artists) parts.push(artists);
  const events = summarizeNames(rules.eventIds, eventNames, '活动');
  if (events) parts.push(events);

  if (rules.specs.length === 1) parts.push(getChekiSpecLabel(rules.specs[0]));
  if (rules.specs.length > 1) parts.push(`${rules.specs.length} 种规格`);
  return parts.length > 0 ? parts.join(' · ') : '尚未设置筛选条件';
}
