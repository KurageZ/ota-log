import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ChekiPickerScreen } from '../../../../src/components/ChekiPickerScreen';
import { isChekiWidgetSlot, type ChekiWidgetSlot } from '../../../../src/types/chekiWidgetGroups';
import {
  getChekiWidgetGroupDraft,
  setChekiWidgetGroupDraft,
} from '../../../../src/utils/chekiWidgetGroupDraftStore';

const MAX_ITEMS = 48;

export default function ChekiWidgetGroupSelectScreen() {
  const { slot: rawSlot } = useLocalSearchParams<{ slot: string }>();
  const slot = Number(rawSlot) as ChekiWidgetSlot;
  const initialSelectedIds = useMemo(() => {
    if (!isChekiWidgetSlot(slot)) return [];
    const draft = getChekiWidgetGroupDraft(slot);
    return draft?.source.type === 'manual' ? draft.source.itemIds : [];
  }, [slot]);

  if (!isChekiWidgetSlot(slot)) return null;

  return (
    <ChekiPickerScreen
      initialSelectedIds={initialSelectedIds}
      maxSelection={MAX_ITEMS}
      showSelectAll
      onCancel={() => router.back()}
      onConfirm={(items) => {
        const draft = getChekiWidgetGroupDraft(slot);
        if (draft?.source.type === 'manual') {
          setChekiWidgetGroupDraft({
            ...draft,
            source: { type: 'manual', itemIds: items.map(({ id }) => id) },
          });
        }
        router.back();
      }}
    />
  );
}
