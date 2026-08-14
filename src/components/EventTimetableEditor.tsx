import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Artist, CreateEventTimetableEntryInput } from '../types/models';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { resolveAvatarSource } from '../utils/avatarSource';
import { withAlpha } from '../utils/color';
import { formatTimeInput, isValidTime } from '../utils/date';
import { generateId } from '../utils/uuid';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { OshiAvatar } from './Oshi';

export interface EventTimetableEntryDraft {
  key: string;
  id?: string;
  source_artist_name?: string;
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
  compact = false,
  leftInset,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  numeric?: boolean;
  compact?: boolean;
  leftInset?: number;
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
        height: compact ? 36 : (multiline ? undefined : 46),
        minHeight: compact ? 36 : (multiline ? 72 : undefined),
        paddingLeft: leftInset ?? (compact ? 10 : 14),
        paddingRight: compact ? 10 : 14,
        paddingVertical: compact ? 0 : (multiline ? 10 : 0),
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: compact ? 10 : 12,
        backgroundColor: colors.input,
        color: colors.text,
        fontSize: compact ? 13.5 : 15,
      }}
    />
  );
}

function matchArtists(artists: Artist[], query: string): Artist[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return artists
    .filter((artist) => getArtistPrimaryName(artist).toLowerCase().includes(q))
    .slice(0, 5);
}

function ReorderButton({
  label,
  icon,
  disabled = false,
  danger = false,
  compact = false,
  onPress,
}: {
  label: string;
  icon: 'chevron' | 'trash';
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
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
      hitSlop={compact ? 5 : undefined}
      style={{
        width: compact ? 30 : 44,
        height: compact ? 36 : 44,
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
      <View>
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
    <View>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>时间表</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: colors.textMuted }}>时间跟随当前场次日期</Text>
        </View>
      </View>

      {entries.map((entry, entryIndex) => {
        const matchedArtist = entry.artist_id
          ? artists.find((artist) => artist.id === entry.artist_id) ?? null
          : null;
        const suggestions = matchedArtist ? [] : matchArtists(artists, entry.title);
        return (
          <View
            key={entry.key}
            style={{
              marginTop: entryIndex === 0 ? 8 : 12,
              paddingTop: entryIndex === 0 ? 0 : 10,
              borderTopWidth: entryIndex === 0 ? 0 : 1,
              borderTopColor: colors.divider,
            }}
          >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  <EditorInput
                    value={entry.title}
                    onChangeText={(title) => updateEntry(entry.key, { title })}
                    placeholder={`条目 ${entryIndex + 1}`}
                    compact
                    leftInset={matchedArtist ? 32 : undefined}
                  />
                  {matchedArtist ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="移除关联艺人"
                      onPress={() => updateEntry(entry.key, { artist_id: '' })}
                      style={{
                        position: 'absolute',
                        left: 6,
                        top: 0,
                        bottom: 0,
                        justifyContent: 'center',
                      }}
                    >
                      <OshiAvatar source={resolveAvatarSource(matchedArtist.avatar_uri)} size={22} isOshi={false} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ReorderButton
                  label="上移时间表条目"
                  icon="chevron"
                  compact
                  disabled={entryIndex === 0}
                  onPress={() => onChange(moveEntry(entries, entryIndex, -1))}
                />
                <ReorderButton
                  label="下移时间表条目"
                  icon="chevron"
                  compact
                  disabled={entryIndex === entries.length - 1}
                  onPress={() => onChange(moveEntry(entries, entryIndex, 1))}
                />
                <ReorderButton
                  label="删除时间表条目"
                  icon="trash"
                  compact
                  danger
                  onPress={() => onChange(entries.filter((item) => item.key !== entry.key))}
                />
              </View>

              {suggestions.length > 0 ? (
                <View style={{
                  marginTop: 6, borderRadius: 10, overflow: 'hidden',
                  borderWidth: 1, borderColor: colors.inputBorder,
                }}>
                  {suggestions.map((artist, index) => (
                    <TouchableOpacity
                      key={artist.id}
                      accessibilityRole="button"
                      accessibilityLabel={`关联 ${getArtistPrimaryName(artist)}`}
                      activeOpacity={0.7}
                      onPress={() => updateEntry(entry.key, {
                        title: getArtistPrimaryName(artist),
                        artist_id: artist.id,
                      })}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 8,
                        paddingHorizontal: 10, paddingVertical: 8,
                        backgroundColor: colors.input,
                        borderBottomWidth: index === suggestions.length - 1 ? 0 : 1,
                        borderBottomColor: colors.inputBorder,
                      }}
                    >
                      <OshiAvatar source={resolveAvatarSource(artist.avatar_uri)} size={20} isOshi={false} />
                      <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                        {getArtistPrimaryName(artist)}
                      </Text>
                      <AppIcon name="add" size={14} color={colors.accent} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, gap: 4 }}>
                <View style={{ width: 58 }}>
                  <EditorInput
                    value={entry.start_time}
                    onChangeText={(start_time) => updateEntry(entry.key, {
                      start_time: formatTimeInput(start_time),
                    })}
                    placeholder="开始"
                    numeric
                    compact
                  />
                </View>
                <View style={{ width: 58 }}>
                  <EditorInput
                    value={entry.end_time}
                    onChangeText={(end_time) => updateEntry(entry.key, {
                      end_time: formatTimeInput(end_time),
                    })}
                    placeholder="结束"
                    numeric
                    compact
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <EditorInput
                    value={entry.notes}
                    onChangeText={(notes) => updateEntry(entry.key, { notes })}
                    placeholder="备注"
                    compact
                  />
                </View>
              </View>
          </View>
        );
      })}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="添加时间表条目"
        activeOpacity={0.7}
        onPress={() => onChange([...entries, createEmptyTimetableEntry()])}
        style={{
          minHeight: 42,
          marginTop: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.accent,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: withAlpha(colors.accent, isDark ? 0.1 : 0.05),
        }}
      >
        <AppIcon name="add" size={16} color={colors.accent} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>添加条目</Text>
      </TouchableOpacity>
    </View>
  );
}
