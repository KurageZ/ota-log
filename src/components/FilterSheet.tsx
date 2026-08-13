import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BottomSheetBackdrop,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { Artist } from '../types/models';
import { ArtistOptionRow } from './ArtistOptionRow';
import { BottomSheetActionFooter } from './BottomSheetDialog';

export interface FilterOption {
  value: string;
  label: string;
  /** 搜索用补充文本；展示仍使用 label */
  searchText?: string;
  subtitle?: string;
  artist?: Artist;
  parentName?: string;
  isOshi?: boolean;
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
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  multiple?: boolean;
  /** 「全部」chip 的文案，默认「全部」 */
  allLabel?: string;
  /** 设置后，该分区顶部显示一个自由文本输入框，options 作为快捷建议 */
  input?: { placeholder?: string };
  /** 设置后，该分区顶部显示一个搜索框，用于在 options 中本地过滤（单选，value 为选项 value） */
  search?: { placeholder?: string };
  /** 标题下方、选择器/已选中区域上方的附加内容（例如批量快捷 chip） */
  beforeContent?: ReactNode;
  /** 设置后，该分区改为渲染多组独立 chip 行，不再渲染 options 的默认 chips */
  chipGroups?: FilterChipGroup[];
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

function SearchOptionRow({
  option,
  label,
  subtitle,
  active,
  isLast,
  isDark,
  trailing = 'check',
  onPress,
  onTrailingPress,
}: {
  option?: FilterOption;
  label: string;
  subtitle?: string;
  active: boolean;
  isLast: boolean;
  isDark: boolean;
  trailing?: 'check' | 'remove';
  onPress?: () => void;
  onTrailingPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const selectedColor = colors.accent;

  if (option?.artist) {
    return (
      <ArtistOptionRow
        artist={option.artist}
        selected={active}
        isDark={isDark}
        isLast={isLast}
        isOshi={Boolean(option.isOshi)}
        parentName={option.parentName}
        colors={colors}
        trailing={active ? trailing : 'none'}
        onPress={onPress ? () => onPress() : undefined}
        onTrailingPress={onTrailingPress ? () => onTrailingPress() : undefined}
      />
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        minHeight: 46,
        paddingHorizontal: 12,
        paddingVertical: subtitle ? 8 : 11,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: active ? withAlpha(colors.accent, isDark ? 0.18 : 0.1) : colors.card,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: isDark ? colors.inputBorder : colors.cardAlt,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            fontWeight: active ? '700' : '500',
            color: active ? selectedColor : colors.text,
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {active ? (
        <TouchableOpacity
          onPress={onTrailingPress}
          activeOpacity={onTrailingPress ? 0.7 : 1}
          disabled={!onTrailingPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon
            name={trailing === 'remove' ? 'closeCircle' : 'statusCompleted'}
            size={16}
            color={selectedColor}
          />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

export function FilterSheet({ visible, sections, isDark, header, onReset, onClose, onApply }: FilterSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const wasVisibleRef = useRef(false);
  const dismissedInternallyRef = useRef(false);
  // 输入型分区的本地草稿，避免受 URL 参数回写影响光标
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // 输入型分区的防抖计时器，按 section.key 区分
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirtyInputKeys = useRef<Set<string>>(new Set());
  const maxSheetHeight = Math.max(320, Math.floor(windowHeight * 0.8));

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
      dismissedInternallyRef.current = false;
      const next: Record<string, string> = {};
      for (const section of sections) {
        if (section.input) next[section.key] = section.value ?? '';
      }
      setDrafts(next);
      dirtyInputKeys.current.clear();
      sheetModalRef.current?.present();
    } else {
      if (wasVisibleRef.current && !dismissedInternallyRef.current) {
        sheetModalRef.current?.dismiss();
      }
      clearDebounceTimers();
      dismissedInternallyRef.current = false;
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  const screen = colors.screen;
  const heading = colors.heading;
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

  const handleDismiss = () => {
    dismissedInternallyRef.current = true;
    wasVisibleRef.current = false;
    flushInputDrafts();
    if (visible) onClose();
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.82}
      pressBehavior="close"
      style={{ backgroundColor: colors.scrim }}
    />
  );

  const renderFooter = (props: BottomSheetFooterProps) => (
    <BottomSheetActionFooter {...props}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="应用筛选"
        onPress={handleApply}
        activeOpacity={0.72}
        style={{
          minHeight: 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.onAccent }}>应用</Text>
      </TouchableOpacity>
    </BottomSheetActionFooter>
  );

  return (
    <BottomSheetModal
      ref={sheetModalRef}
      enableDynamicSizing
      enableDismissOnClose
      enablePanDownToClose
      maxDynamicContentSize={maxSheetHeight}
      // Keep the sheet background flush with the viewport; the scroll content
      // already owns the safe-area padding below.
      bottomInset={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      footerComponent={onApply ? renderFooter : undefined}
      backgroundStyle={{
        backgroundColor: screen,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.inputBorder,
      }}
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableFooterMarginAdjustment={Boolean(onApply)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: onApply ? 20 : Math.max(insets.bottom, 12) + 20,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
        >
          <TouchableOpacity onPress={handleReset} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: subText }}>重置</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '800', color: heading }}>筛选</Text>
          <View style={{ width: 42 }} />
        </View>

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

          // 搜索型分区：本地过滤 options；已选项单独显示在搜索框上方，候选列表只负责继续选择
          const selectedValues = section.values ?? (section.value != null ? [section.value] : []);
          const selectedSet = new Set(selectedValues);
          let displayedOptions = section.options;
          let selectedOptions: FilterOption[] = [];
          if (section.search) {
            const query = (drafts[section.key] ?? '').trim().toLowerCase();
            let matched = query
              ? section.options.filter((option) =>
                `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(query)
              )
              : section.options;
            if (selectedValues.length > 0) {
              selectedOptions = selectedValues
                .flatMap((value) => section.options.find((option) => option.value === value) ?? []);
              matched = matched.filter((option) => !selectedSet.has(option.value));
            }
            displayedOptions = matched.slice(0, 40);
          }

          const showAllChip = !section.input;
          const showSearchList = Boolean(section.search);

          return (
            <View key={section.key} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: subText, marginBottom: 10 }}>
                {section.title}
              </Text>

              {section.beforeContent ? (
                <View style={{ marginBottom: 10 }}>{section.beforeContent}</View>
              ) : null}

              {section.input ? (
                <BottomSheetTextInput
                  style={{ ...inputStyle, marginBottom: section.options.length > 0 ? 10 : 0 }}
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

              {section.search && selectedOptions.length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                    已选中
                  </Text>
                  <View
                    style={{
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      overflow: 'hidden',
                      backgroundColor: colors.card,
                    }}
                  >
                    {selectedOptions.map((option, index) => (
                      <SearchOptionRow
                        key={option.value}
                        option={option}
                        label={option.label}
                        subtitle={option.subtitle}
                        active
                        isDark={isDark}
                        isLast={index === selectedOptions.length - 1}
                        trailing="remove"
                        onTrailingPress={() => {
                          if (section.multiple) {
                            section.onValuesChange?.(selectedValues.filter((value) => value !== option.value));
                          } else {
                            setSectionValue(section, null);
                          }
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {section.search ? (
                <BottomSheetTextInput
                  style={{ ...inputStyle, marginBottom: 10 }}
                  placeholder={section.search.placeholder}
                  placeholderTextColor={colors.placeholder}
                  value={drafts[section.key] ?? ''}
                  onChangeText={(text) => setDrafts((prev) => ({ ...prev, [section.key]: text }))}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                  returnKeyType="search"
                />
              ) : null}

              {section.chipGroups ? (
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
              ) : showSearchList ? (
                <View
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    overflow: 'hidden',
                    maxHeight: 236,
                    backgroundColor: colors.card,
                  }}
                >
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <SearchOptionRow
                      label={section.allLabel ?? '全部'}
                      active={selectedValues.length === 0}
                      isDark={isDark}
                      isLast={displayedOptions.length === 0}
                      onPress={() => {
                        if (section.multiple) {
                          section.onValuesChange?.([]);
                        } else {
                          setSectionValue(section, null);
                        }
                      }}
                    />
                    {displayedOptions.map((option, index) => (
                      <SearchOptionRow
                        key={option.value}
                        option={option}
                        label={option.label}
                        subtitle={option.subtitle}
                        active={selectedSet.has(option.value)}
                        isDark={isDark}
                        isLast={index === displayedOptions.length - 1}
                        onPress={() => {
                          if (section.multiple) {
                            const next = selectedSet.has(option.value)
                              ? selectedValues.filter((value) => value !== option.value)
                              : [...selectedValues, option.value];
                            section.onValuesChange?.(next);
                          } else {
                            setSectionValue(section, option.value);
                          }
                        }}
                      />
                    ))}
                    {displayedOptions.length === 0 ? (
                      <View style={{ padding: 14, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>
                          没有找到匹配项
                        </Text>
                      </View>
                    ) : null}
                  </ScrollView>
                </View>
              ) : displayedOptions.length > 0 || showAllChip ? (
                // 限制最多三行（chip 34 + gap 8），超出部分裁掉，靠搜索/输入找其余项
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
                  {displayedOptions.map((option) => {
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
