import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { Artist, Event } from '../types/models';
import { EventSearchPicker } from './EventSearchPicker';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { BottomSheetDialog, BottomSheetAction } from './BottomSheetDialog';

export interface FilterOption {
  value: string;
  label: string;
}

/** 分区标题下的一组独立 chip 行；不设置 title 时该组 chips 直接展示 */
export interface FilterChipGroup {
  key: string;
  options: FilterOption[];
  title?: string;
  value?: string | null;
  values?: string[];
  multiple?: boolean;
  onChange?: (value: string | null) => void;
  onValuesChange?: (values: string[]) => void;
  /** 「全部」chip 的文案，默认「全部」 */
  allLabel?: string;
  /** 设置后在该组开头显示「全部」chip */
  showAllChip?: boolean;
}

export interface FilterSection {
  key: string;
  title: string;
  options?: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  multiple?: boolean;
  /** 「全部」chip 的文案，默认「全部」 */
  allLabel?: string;
  /** 设置后，该分区顶部显示一个自由文本输入框，options 作为快捷建议 */
  input?: { placeholder?: string };
  /** 设置后，该分区改用共享的 ArtistSearchPicker 渲染艺人选择 */
  artistSearch?: ArtistSearchSectionConfig;
  eventSearch?: { events: Event[] };
  /** 标题下方、选择器/已选中区域上方的附加内容（例如批量快捷 chip） */
  beforeContent?: ReactNode;
  /** 设置后，该分区改为渲染多组独立 chip 行，不再渲染 options 的默认 chips */
  chipGroups?: FilterChipGroup[];
}

export interface ArtistSearchSectionConfig {
  /** 候选艺人列表（含所属团体），顺序仅作为同档内的稳定序 */
  artists: Artist[];
  /** 完整艺人库（含所属团体），用于搜索匹配与所属链解析；候选列表是子集时传入 */
  lookup?: Artist[];
  oshiArtistId?: string | null;
  parentNameMap?: Record<string, string>;
  placeholder?: string;
  /** 类型优先：'group' 团体优先，'person' 个人优先，不传/null 不区分类型 */
  typePreference?: 'group' | 'person' | null;
  /** 已选但 artists 中不存在对应记录的兜底行（例如已删除的艺人） */
  extraSelectedRows?: Array<{ id: string; label: string; subtitle?: string }>;
}

interface FilterSheetProps {
  visible: boolean;
  sections: FilterSection[];
  isDark: boolean;
  header?: ReactNode;
  onReset: () => void;
  onClose: () => void;
  onApply?: () => void;
}

function Chip({
  label,
  active,
  isDark,
  onPress,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 99,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        backgroundColor: active ? colors.accent : isDark ? colors.input : colors.cardAlt,
        borderColor: active ? colors.accent : colors.inputBorder,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: active ? colors.onAccent : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function FilterSheet({ visible, sections, isDark, header, onReset, onClose, onApply }: FilterSheetProps) {
  const { colors } = useAppTheme();
  // 输入型分区的本地草稿，避免受 URL 参数回写影响光标
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // 输入型分区的防抖计时器，按 section.key 区分
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirtyInputKeys = useRef<Set<string>>(new Set());
  const clearDebounceTimers = () => {
    for (const timer of Object.values(debounceTimers.current)) clearTimeout(timer);
    debounceTimers.current = {};
  };

  const clearDebounceTimer = (sectionKey: string) => {
    const timer = debounceTimers.current[sectionKey];
    if (timer) clearTimeout(timer);
    delete debounceTimers.current[sectionKey];
  };

  useEffect(() => () => clearDebounceTimers(), []);

  useEffect(() => {
    if (visible) {
      const next: Record<string, string> = {};
      for (const section of sections) {
        if (section.input) next[section.key] = section.value ?? '';
      }
      setDrafts(next);
      dirtyInputKeys.current.clear();
    } else {
      clearDebounceTimers();
    }
  }, [visible]);

  const subText = colors.textSecondary;

  const setSectionValue = (section: FilterSection, value: string | null) => {
    if (section.input) {
      clearDebounceTimer(section.key);
      dirtyInputKeys.current.delete(section.key);
      setDrafts((prev) => ({ ...prev, [section.key]: value ?? '' }));
    }
    section.onChange(value);
  };

  const flushInputDrafts = () => {
    for (const section of sections) {
      if (!section.input) continue;
      if (!dirtyInputKeys.current.has(section.key)) continue;
      clearDebounceTimer(section.key);
      const trimmed = (drafts[section.key] ?? '').trim();
      section.onChange(trimmed ? trimmed : null);
    }
    dirtyInputKeys.current.clear();
  };

  const handleReset = () => {
    clearDebounceTimers();
    dirtyInputKeys.current.clear();
    setDrafts({});
    onReset();
  };

  const handleApply = () => {
    flushInputDrafts();
    onApply?.();
  };

  const applyButton = (
    <BottomSheetAction label="应用" accessibilityLabel="应用筛选" onPress={handleApply} />
  );

  const content = (
    <>
      {header}
      {sections.map((section) => {
        const inputStyle = {
          backgroundColor: isDark ? colors.input : colors.cardMuted,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          paddingHorizontal: 12,
          height: 42,
          fontSize: 14,
          color: colors.text,
        } as const;
        const options = section.options ?? [];

        const selectedValues = section.values ?? (section.value != null ? [section.value] : []);
        const selectedSet = new Set(selectedValues);
        const showAllChip = !section.input;
        const showSearchPicker = Boolean(section.artistSearch || section.eventSearch);

        return (
          <View key={section.key} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: subText, marginBottom: 10 }}>
              {section.title}
            </Text>

            {section.beforeContent ? (
              <View style={{ marginBottom: 10 }}>{section.beforeContent}</View>
            ) : null}

            {section.artistSearch ? (
              <ArtistSearchPicker
                artists={section.artistSearch.artists}
                lookup={section.artistSearch.lookup}
                selectedIds={selectedValues}
                oshiArtistId={section.artistSearch.oshiArtistId}
                isDark={isDark}
                searchValue={drafts[section.key] ?? ''}
                onSearchChange={(text) => setDrafts((prev) => ({ ...prev, [section.key]: text }))}
                parentNameMap={section.artistSearch.parentNameMap}
                placeholder={section.artistSearch.placeholder}
                typePreference={section.artistSearch.typePreference}
                inputVariant="bottomSheet"
                selectedLabel="已选中"
                maxHeight={236}
                extraSelectedRows={section.artistSearch.extraSelectedRows}
                onSelectArtist={(artist) => {
                  if (section.multiple) {
                    section.onValuesChange?.([...selectedValues, artist.id]);
                  } else {
                    setSectionValue(section, artist.id);
                  }
                }}
                onRemoveArtist={(artist) => {
                  if (section.multiple) {
                    section.onValuesChange?.(selectedValues.filter((value) => value !== artist.id));
                  } else {
                    setSectionValue(section, null);
                  }
                }}
                onRemoveExtraSelectedRow={(id) => {
                  if (section.multiple) {
                    section.onValuesChange?.(selectedValues.filter((value) => value !== id));
                  } else {
                    setSectionValue(section, null);
                  }
                }}
              />
            ) : null}

            {section.eventSearch ? (
              <EventSearchPicker
                events={section.eventSearch.events}
                selectedIds={selectedValues}
                searchValue={drafts[section.key] ?? ''}
                onSearchChange={(text) => setDrafts((prev) => ({ ...prev, [section.key]: text }))}
                onSelect={(id) => {
                  if (section.multiple) section.onValuesChange?.([...selectedValues, id]);
                  else setSectionValue(section, id);
                }}
                onRemove={(id) => {
                  if (section.multiple) section.onValuesChange?.(selectedValues.filter((value) => value !== id));
                  else setSectionValue(section, null);
                }}
              />
            ) : null}

            {section.input ? (
              <BottomSheetTextInput
                style={{ ...inputStyle, marginBottom: options.length > 0 ? 10 : 0 }}
                placeholder={section.input.placeholder}
                placeholderTextColor={colors.placeholder}
                value={drafts[section.key] ?? ''}
                onChangeText={(text) => {
                  dirtyInputKeys.current.add(section.key);
                  setDrafts((prev) => ({ ...prev, [section.key]: text }));
                  const trimmed = text.trim();
                  const existing = debounceTimers.current[section.key];
                  if (existing) clearTimeout(existing);
                  debounceTimers.current[section.key] = setTimeout(() => {
                    section.onChange(trimmed ? trimmed : null);
                    dirtyInputKeys.current.delete(section.key);
                    delete debounceTimers.current[section.key];
                  }, 300);
                }}
                clearButtonMode="while-editing"
                autoCorrect={false}
                returnKeyType="search"
              />
            ) : null}

            {!showSearchPicker && section.chipGroups ? (
              <View style={{ gap: 12 }}>
                {section.chipGroups.map((group) => {
                  const groupSelected = group.values ?? (group.value != null ? [group.value] : []);
                  const groupSelectedSet = new Set(groupSelected);
                  return (
                    <View key={group.key}>
                      {group.title ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                          {group.title}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {group.showAllChip ? (
                          <Chip
                            label={group.allLabel ?? '全部'}
                            active={groupSelected.length === 0}
                            isDark={isDark}
                            onPress={() => {
                              if (group.multiple) group.onValuesChange?.([]);
                              else group.onChange?.(null);
                            }}
                          />
                        ) : null}
                        {group.options.map((option) => {
                          const active = group.multiple
                            ? groupSelectedSet.has(option.value)
                            : group.value === option.value;
                          return (
                            <Chip
                              key={option.value}
                              label={option.label}
                              active={active}
                              isDark={isDark}
                              onPress={() => {
                                if (group.multiple) {
                                  const next = active
                                    ? groupSelected.filter((value) => value !== option.value)
                                    : [...groupSelected, option.value];
                                  group.onValuesChange?.(next);
                                } else if (active) {
                                  group.onChange?.(null);
                                } else {
                                  group.onChange?.(option.value);
                                }
                              }}
                            />
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : !showSearchPicker && (options.length > 0 || showAllChip) ? (
              // 限制最多三行（chip 34 + gap 8），超出部分裁掉，靠输入找其余项
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {showAllChip ? (
                  <Chip
                    label={section.allLabel ?? '全部'}
                    active={selectedValues.length === 0}
                    isDark={isDark}
                    onPress={() => {
                      if (section.multiple) section.onValuesChange?.([]);
                      else setSectionValue(section, null);
                    }}
                  />
                ) : null}
                {options.map((option) => {
                  const active = section.multiple ? selectedSet.has(option.value) : section.value === option.value;
                  return (
                    <Chip
                      key={option.value}
                      label={option.label}
                      active={active}
                      isDark={isDark}
                      onPress={() => {
                        if (section.multiple) {
                          const next = active
                            ? selectedValues.filter((value) => value !== option.value)
                            : [...selectedValues, option.value];
                          section.onValuesChange?.(next);
                        } else if (active) {
                          setSectionValue(section, null);
                        } else {
                          setSectionValue(section, option.value);
                        }
                      }}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );

  return (
    <BottomSheetDialog
      visible={visible}
      title="筛选"
      onClose={onClose}
      scrollable
      headerAccessory={(
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="重置筛选"
          onPress={handleReset}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>重置</Text>
        </TouchableOpacity>
      )}
      footer={onApply ? applyButton : undefined}
      >
      {content}
    </BottomSheetDialog>
  );
}
