import { StatsDateRangePicker } from './StatsDateRangePicker';
import { StatsPeriodPicker } from './StatsPeriodPicker';
import {
  createCustomStatsRange,
  createPresetStatsRange,
  type StatsDateRange,
} from '../utils/statsDateRange';

export type StatsRangePickerMode = 'week' | 'month' | 'year' | 'custom';

interface Props {
  visible: boolean;
  mode: StatsRangePickerMode;
  period: StatsDateRange;
  initialCustomStartDate: string | null;
  initialCustomEndDate: string | null;
  onClose: () => void;
  onSelect: (range: StatsDateRange) => void;
}

/**
 * Unified statistics range picker. The requested mode is explicit and does
 * not depend on the range that is currently applied to the statistics page.
 */
export function StatsRangePicker({
  visible,
  mode,
  period,
  initialCustomStartDate,
  initialCustomEndDate,
  onClose,
  onSelect,
}: Props) {
  if (mode === 'custom') {
    return (
      <StatsDateRangePicker
        visible={visible}
        initialStartDate={initialCustomStartDate}
        initialEndDate={initialCustomEndDate}
        onCancel={onClose}
        onConfirm={(startDate, endDate) => {
          const range = createCustomStatsRange(startDate, endDate);
          if (range) onSelect(range);
        }}
        onSelectAll={() => onSelect(createPresetStatsRange('all'))}
      />
    );
  }

  return (
    <StatsPeriodPicker
      visible={visible}
      preset={mode}
      period={period}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}
