import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Artist, CreateEventTimetableEntryInput } from '../types/models';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { withAlpha } from '../utils/color';
import { formatTimeInput, isValidTime } from '../utils/date';
import { generateId } from '../utils/uuid';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { FormFieldLabel } from './FormPrimitives';

export interface EventTimetableEntryDraft {
  key: string;
  id?: string;
  title: string;
  artist_id: string;
  start_time: string;
  end_time: string;
  notes: string;
}

export function createEmptyTimetableEntry(): EventTimetableEntryDraft {
  return {
    key: generateId(),
    title: '',
    artist_id: '',
    start_time: '',
    end_time: '',
    notes: '',
  };
}

export function toTimetableReplacementInput(
  entries: EventTimetableEntryDraft[],
): CreateEventTimetableEntryInput[] {
  return entries.map((entry) => ({
    title: entry.title,
    artist_id: entry.artist_id || null,
    start_time: entry.start_time || null,
    end_time: entry.end_time || null,
    notes: entry.notes || null,
  }));
}

export function getTimetableValidationError(
  entries: EventTimetableEntryDraft[],
): string | null {
  for (const entry of entries) {
    if (!entry.title.trim()) return '请填写时间表内容';
    for (const time of [entry.start_time, entry.end_time]) {
      if (time && !isValidTime(time)) return '时间表的时间格式应为 HH:MM';
    }
  }
  return null;
}

function EditorInput({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numeric = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  numeric?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      keyboardType={numeric ? 'numeric' : 'default'}
      maxLength={numeric ? 5 : undefined}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={{
        height: multiline ? undefined : 46,
        minHeight: multiline ? 72 : undefined,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 10 : 0,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 12,
        backgroundColor: colors.input,
        color: colors.text,
        fontSize: 15,
      }}
    />
  );
}

function ReorderButton({
  label,
  icon,
  disabled = false,
  danger = false,
  onPress,
}: {
  label: string;
  icon: 'chevron' | 'trash';
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <AppIcon
        name={icon}
        variant={icon === 'chevron' ? (label.includes('上移') ? 'up' : 'down') : undefined}
        size={icon === 'trash' ? 17 : 18}
        color={danger ? colors.danger : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

function moveEntry(
  entries: EventTimetableEntryDraft[],
  index: number,
  direction: -1 | 1,
): EventTimetableEntryDraft[] {
  const destination = index + direction;
  if (destination < 0 || destination >= entries.length) return entries;
  const next = [...entries];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function EventTimetableEditor({
  entries,
  artists,
  onChange,
}: {
  entries: EventTimetableEntryDraft[];
  artists: Artist[];
  onChange: (entries: EventTimetableEntryDraft[]) => void;
}) {
  const { colors, isDark } = useAppTheme();

  if (entries.length === 0) {
    return (
      <View style={{ marginTop: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="添加时间表"
          activeOpacity={0.7}
          onPress={() => onChange([createEmptyTimetableEntry()])}
          style={{
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <AppIcon name="add" size={16} color={colors.accent} />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.accent }}>添加时间表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const updateEntry = (entryKey: string, patch: Partial<EventTimetableEntryDraft>) => {
    onChange(entries.map((entry) => (
      entry.key === entryKey ? { ...entry, ...patch } : entry
    )));
  };

  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider }}>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>时间表</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: colors.textMuted }}>时间跟随当前场次日期</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="添加时间表条目"
          activeOpacity={0.7}
          onPress={() => onChange([...entries, createEmptyTimetableEntry()])}
          style={{
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.accent, isDark ? 0.15 : 0.08),
          }}
        >
          <AppIcon name="add" size={14} color={colors.accent} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>添加条目</Text>
        </TouchableOpacity>
      </View>

      {entries.map((entry, entryIndex) => (
        <View
          key={entry.key}
          style={{
            marginTop: entryIndex === 0 ? 8 : 18,
            paddingTop: entryIndex === 0 ? 0 : 14,
            borderTopWidth: entryIndex === 0 ? 0 : 1,
            borderTopColor: colors.divider,
          }}
        >
          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
              条目 {entryIndex + 1}
            </Text>
            <ReorderButton
              label="上移时间表条目"
              icon="chevron"
              disabled={entryIndex === 0}
              onPress={() => onChange(moveEntry(entries, entryIndex, -1))}
            />
            <ReorderButton
              label="下移时间表条目"
              icon="chevron"
              disabled={entryIndex === entries.length - 1}
              onPress={() => onChange(moveEntry(entries, entryIndex, 1))}
            />
            <ReorderButton
              label="删除时间表条目"
              icon="trash"
              danger
              onPress={() => onChange(entries.filter((item) => item.key !== entry.key))}
            />
          </View>

          <FormFieldLabel required>演出内容</FormFieldLabel>
          <EditorInput
            value={entry.title}
            onChangeText={(title) => updateEntry(entry.key, { title })}
            placeholder="如：Opening、艺人 LIVE、终演后物贩"
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>开始</FormFieldLabel>
              <EditorInput
                value={entry.start_time}
                onChangeText={(start_time) => updateEntry(entry.key, {
                  start_time: formatTimeInput(start_time),
                })}
                placeholder="HH:MM"
                numeric
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormFieldLabel>结束</FormFieldLabel>
              <EditorInput
                value={entry.end_time}
                onChangeText={(end_time) => updateEntry(entry.key, {
                  end_time: formatTimeInput(end_time),
                })}
                placeholder="HH:MM"
                numeric
              />
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <FormFieldLabel>关联出演者</FormFieldLabel>
            {artists.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {[null, ...artists].map((artist) => {
                  const artistId = artist?.id ?? '';
                  const selected = entry.artist_id === artistId;
                  const label = artist ? getArtistPrimaryName(artist) : '不关联';
                  return (
                    <TouchableOpacity
                      key={artistId || 'none'}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      activeOpacity={0.7}
                      onPress={() => updateEntry(entry.key, { artist_id: artistId })}
                      style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.inputBorder,
                        backgroundColor: selected
                          ? withAlpha(colors.accent, isDark ? 0.2 : 0.1)
                          : colors.input,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: selected ? '700' : '500',
                        color: selected ? colors.accent : colors.textSecondary,
                      }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
                可先在「详细信息」中添加出演者
              </Text>
            )}
          </View>

          <View style={{ marginTop: 12 }}>
            <FormFieldLabel>备注</FormFieldLabel>
            <EditorInput
              value={entry.notes}
              onChangeText={(notes) => updateEntry(entry.key, { notes })}
              placeholder="特典会时间或其他说明"
              multiline
            />
          </View>
        </View>
      ))}
    </View>
  );
}
