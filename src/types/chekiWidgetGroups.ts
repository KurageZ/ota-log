import type { ChekiSpec } from '../domain/chekiSpec';

export type ChekiWidgetSlot = 1 | 2 | 3 | 4 | 5 | 6;
export type ChekiWidgetSourceType = 'manual' | 'filter';
export type ChekiWidgetDatePreset = 'current_month' | 'current_year' | 'custom';
export const CHEKI_WIDGET_ROTATION_INTERVAL_MS = 30 * 60 * 1000;

export interface ChekiWidgetFilterRules {
  artistIds: string[];
  eventIds: string[];
  favoriteOnly: boolean;
  date: null | { preset: 'current_month' | 'current_year' } | {
    preset: 'custom';
    startDate: string;
    endDate: string;
  };
  specs: ChekiSpec[];
}

export type ChekiWidgetGroupSource =
  | { type: 'manual'; itemIds: string[] }
  | { type: 'filter'; rules: ChekiWidgetFilterRules };

export type SaveChekiWidgetGroupInput = {
  name: string;
  source: ChekiWidgetGroupSource;
};

export interface ResolvedChekiWidgetItem {
  spec: ChekiSpec;
  id: string;
  frontPhotoUri: string;
  date: string | null;
  createdAt: string;
  sortOrder: number;
}

export interface ChekiWidgetGroupSummary {
  slot: ChekiWidgetSlot;
  name: string;
  sourceType: ChekiWidgetSourceType | null;
  displayCount: number;
}

export interface ChekiWidgetGroupEditorState {
  slot: ChekiWidgetSlot;
  name: string;
  source: ChekiWidgetGroupSource | null;
  resolvedItems: ResolvedChekiWidgetItem[];
}

export interface ResolvedChekiWidgetGroup {
  slot: ChekiWidgetSlot;
  name: string;
  sourceType: ChekiWidgetSourceType | null;
  state: 'unconfigured' | 'no_match' | 'unavailable' | 'content';
  items: ResolvedChekiWidgetItem[];
  collectionFingerprint: string | null;
  rotationAnchorAt: string | null;
}

export function isChekiWidgetSlot(value: number): value is ChekiWidgetSlot {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function defaultChekiWidgetGroupName(slot: ChekiWidgetSlot): string {
  return `分组 ${slot}`;
}
