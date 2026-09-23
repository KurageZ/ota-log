import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { Event } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

export function EventSearchPicker({ events, selectedIds, searchValue, onSearchChange, onSelect, onRemove }: {
  events: Event[];
  selectedIds: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { colors, isDark } = useAppTheme();
  const selectedSet = new Set(selectedIds);
  const selectedEvents = events.filter((event) => selectedSet.has(event.id));
  const query = searchValue.trim().toLowerCase();
  const candidates = events.filter((event) => !selectedSet.has(event.id)
    && (!query || event.title.toLowerCase().includes(query) || event.event_date.includes(query)));
  // 与艺人选择器一致，限制嵌套滚动区的渲染数量，其余通过搜索定位。
  const visibleCandidates = candidates.slice(0, query ? 80 : 32);
  const hiddenCount = candidates.length - visibleCandidates.length;

  const renderEvent = (event: Event, selected: boolean) => (
    <TouchableOpacity
      key={event.id}
      accessibilityRole="button"
      accessibilityLabel={`${selected ? '移除' : '选择'}活动 ${event.title} ${event.event_date}`}
      accessibilityState={{ selected }}
      onPress={() => selected ? onRemove(event.id) : onSelect(event.id)}
      activeOpacity={0.7}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, color: colors.text }}>{event.title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>{event.event_date}</Text>
      </View>
      {selected ? <AppIcon name="closeCircle" size={18} color={colors.accent} /> : null}
    </TouchableOpacity>
  );

  return (
    <View>
      {selectedEvents.length > 0 ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>已选中</Text>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 236, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder }}>
            {selectedEvents.map((event) => renderEvent(event, true))}
          </ScrollView>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? colors.input : colors.cardMuted, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 10, minHeight: 44, marginBottom: 8 }}>
        <AppIcon name="search" size={14} color={colors.placeholder} />
        <BottomSheetTextInput
          accessibilityLabel="搜索活动"
          placeholder="搜索日期或活动名称"
          placeholderTextColor={colors.placeholder}
          value={searchValue}
          onChangeText={onSearchChange}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
          style={{ flex: 1, fontSize: 13, color: colors.text }}
        />
      </View>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 236, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder }}>
        {visibleCandidates.map((event) => renderEvent(event, false))}
        {candidates.length === 0 ? <Text style={{ padding: 14, textAlign: 'center', fontSize: 13, color: colors.textMuted }}>{query ? '没有找到匹配的活动' : '暂无可选活动'}</Text> : null}
        {hiddenCount > 0 ? <Text style={{ padding: 12, textAlign: 'center', fontSize: 12, color: colors.textMuted }}>还有 {hiddenCount} 场活动，输入关键词继续筛选</Text> : null}
      </ScrollView>
    </View>
  );
}
