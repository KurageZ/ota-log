import type { ReactElement } from 'react';
import { StatsDateRangePicker } from '../StatsDateRangePicker';
import { StatsPeriodPicker } from '../StatsPeriodPicker';
import { StatsRangePicker } from '../StatsRangePicker';
import type { StatsDateRange } from '../../utils/statsDateRange';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../StatsDateRangePicker', () => ({
  StatsDateRangePicker: jest.fn(),
}));
jest.mock('../StatsPeriodPicker', () => ({
  StatsPeriodPicker: jest.fn(),
}));

describe('StatsRangePicker', () => {
  const monthPeriod: StatsDateRange = {
    preset: 'month',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  };

  test('uses the custom range picker independently of the applied period', () => {
    const onSelect = jest.fn();
    const tree = StatsRangePicker({
      visible: true,
      mode: 'custom',
      period: monthPeriod,
      initialCustomStartDate: null,
      initialCustomEndDate: null,
      onClose: jest.fn(),
      onSelect,
    }) as ReactElement<{
      onConfirm: (startDate: string, endDate: string) => void;
      onSelectAll: () => void;
    }>;

    expect(tree.type).toBe(StatsDateRangePicker);
    tree.props.onConfirm('2026-07-20', '2026-08-12');
    expect(onSelect).toHaveBeenLastCalledWith({
      preset: 'custom',
      startDate: '2026-07-20',
      endDate: '2026-08-12',
    });

    tree.props.onSelectAll();
    expect(onSelect).toHaveBeenLastCalledWith({ preset: 'all', startDate: null, endDate: null });
  });

  test('uses the requested natural period picker', () => {
    const tree = StatsRangePicker({
      visible: true,
      mode: 'week',
      period: monthPeriod,
      initialCustomStartDate: null,
      initialCustomEndDate: null,
      onClose: jest.fn(),
      onSelect: jest.fn(),
    });

    expect(tree.type).toBe(StatsPeriodPicker);
    expect(tree.props.preset).toBe('week');
  });
});
