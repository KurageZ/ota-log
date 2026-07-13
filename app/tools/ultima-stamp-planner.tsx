import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/AppIcon';
import { SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme, type ThemeColors } from '../../src/theme/appTheme';
import {
  ULTIMA_GROUPS,
  ULTIMA_POINT_CAP_PER_EVENT,
  ULTIMA_TIMETREE_EVENTS,
  ULTIMA_YUAN_PER_POINT,
  applyUltimaAutoPlan,
  calculateUltimaGroupStats,
  calculateUltimaOverview,
  clampUltimaGroupSpend,
  clampUltimaParticipation,
  clampUltimaTarget,
  clampUltimaTask,
  createDefaultUltimaPlannerState,
  getActiveUltimaGroups,
  getEventActiveGroupKeys,
  getUltimaEntry,
  getUltimaEntryParticipation,
  getUltimaEntryTask,
  getUltimaEventPlan,
  getUltimaEventPlanStatus,
  getUltimaGroup,
  isUltimaEventExpired,
  isUltimaEventActive,
  makeEntryKey,
  resetUltimaPlannedEvents,
  toPlannerNumber,
  updateUltimaEventTask,
  type UltimaAutoPlanStrategy,
  type UltimaEventPlanStatus,
  type UltimaGroupKey,
  type UltimaPlannerEntry,
  type UltimaPlannerState,
} from '../../src/utils/ultimaStampPlanner';
import {
  loadUltimaUpdateNoticeDismissed,
  loadUltimaPlannerState,
  saveUltimaPlannerState,
  saveUltimaUpdateNoticeDismissed,
} from '../../src/utils/ultimaStampPlannerStorage';

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}

function MetricCard({
  value,
  label,
  colors,
}: {
  value: string | number;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 142,
        borderRadius: 16,
        padding: 14,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text style={{ marginTop: 3, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

function DraftNumberInput({
  value,
  onChange,
  editable = true,
  placeholder,
  placeholderTextColor,
  style,
}: {
  value: string | number;
  onChange?: (value: string) => void;
  editable?: boolean;
  placeholder?: string;
  placeholderTextColor?: string;
  style: StyleProp<TextStyle>;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraft(String(value));
  }, [isFocused, value]);

  const commitDraft = useCallback(() => {
    onChange?.(draft);
  }, [draft, onChange]);

  return (
    <TextInput
      value={draft}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      keyboardType="number-pad"
      editable={editable}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commitDraft();
      }}
      onSubmitEditing={commitDraft}
      onChangeText={(text) => {
        setDraft(text);
        if (text !== '') onChange?.(text);
      }}
      style={style}
    />
  );
}

function NumberField({
  label,
  value,
  onChange,
  colors,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  colors: ThemeColors;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={{ flex: 1, minWidth: 104, gap: 5 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{label}</Text>
      <DraftNumberInput
        value={String(value)}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        editable={editable}
        onChange={onChange}
        style={{
          minHeight: 38,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: editable ? colors.input : colors.cardAlt,
          paddingHorizontal: 10,
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
        }}
      />
    </View>
  );
}

function CompactNumberField({
  label,
  value,
  onChange,
  colors,
  editable = true,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  colors: ThemeColors;
  editable?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 86,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: editable ? colors.input : colors.cardAlt,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.textSecondary }}>
        {label}
      </Text>
      {editable ? (
        <DraftNumberInput
          value={String(value)}
          onChange={onChange}
          style={{
            minHeight: 24,
            padding: 0,
            color: colors.text,
            fontSize: 18,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
          }}
        />
      ) : (
        <Text style={{ minHeight: 24, color: colors.text, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      )}
    </View>
  );
}

function Badge({
  label,
  colors,
  tone = 'neutral',
}: {
  label: string;
  colors: ThemeColors;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const tint = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.textSecondary;
  const bg = tone === 'success' ? colors.successSoft : tone === 'warning' ? colors.warningSoft : colors.cardAlt;

  return (
    <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: tint }}>{label}</Text>
    </View>
  );
}

const PLAN_STATUS_OPTIONS: Array<{ value: UltimaEventPlanStatus; label: string }> = [
  { value: 'planned', label: '已计划' },
  { value: 'unplanned', label: '未计划' },
  { value: 'attended', label: '已参加' },
];

const AUTO_PLAN_STRATEGY_OPTIONS: Array<{ value: UltimaAutoPlanStrategy; label: string }> = [
  { value: 'minimalEvents', label: '最少活动' },
  { value: 'minimalEventsNoSpend', label: '不消费' },
];

const STAMP_RULES = [
  '来场打卡：到场后凭活动门票和任意消费记录，可获得 1pt。每场每人最多 1pt。',
  '任务挑战：单次消费每满 200 元，或完成当日任务，可获得 1pt。多次完成可累积，每场最多 4pt。',
  '当日三项任务会每周提前在微博公布，请关注后续公告。',
  '集章卡以团体为单位，每张集章卡上限 50pt，需按顺序集章。',
  '活动期间每个人最多兑换两张集章卡。',
  '累计 pt 点数可领取对应奖励，领取奖励不扣除点数。',
];

const STAMP_REWARDS = [
  ['2pt', '手机合影券 x1，需配合特典券使用，不含聊天'],
  ['5pt', '自选成员盲盒拍立得 x1'],
  ['10pt', '自选成员带签特典券 x1'],
  ['15pt', '自选成员视频券 15s'],
  ['20pt', '自选成员绘制你们的双人夏日形象色纸 x1'],
  ['25pt', '自选成员带签特典券 x1'],
  ['30pt', '自选单人/团体五寸带签拍立得券 x1'],
  ['35pt', '自选成员带签特典券 x1'],
  ['40pt', '指定单人/全员手写留言“夏日寄语”相卡'],
  ['45pt', '2026.06.19 至 2026.12.31 期间任意一场活动普通门票 x1'],
  ['50pt', '夏日集章活动限定 T 恤 x1'],
];

function PlanStatusControl({
  value,
  onChange,
  colors,
}: {
  value: UltimaEventPlanStatus;
  onChange: (value: UltimaEventPlanStatus) => void;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 204,
        flexDirection: 'row',
        borderRadius: 12,
        backgroundColor: colors.cardAlt,
        padding: 3,
        gap: 3,
      }}
    >
      {PLAN_STATUS_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.72}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 34,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.accent : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? colors.onAccent : colors.textSecondary }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AutoPlanStrategyControl({
  value,
  onChange,
  colors,
}: {
  value: UltimaAutoPlanStrategy;
  onChange: (value: UltimaAutoPlanStrategy) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>补足策略</Text>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 12,
          backgroundColor: colors.cardAlt,
          padding: 3,
          gap: 3,
        }}
      >
        {AUTO_PLAN_STRATEGY_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.72}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 34,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.accent : 'transparent',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? colors.onAccent : colors.textSecondary }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PlannerPointCell({
  label,
  value,
  colors,
  editable = false,
  onChange,
}: {
  label: string;
  value: number;
  colors: ThemeColors;
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <View style={{ width: 58, gap: 4 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.textSecondary }}>{label}</Text>
      {editable ? (
        <DraftNumberInput
          value={String(value)}
          onChange={onChange}
          style={{
            minHeight: 34,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.input,
            paddingHorizontal: 6,
            color: colors.text,
            fontSize: 13,
            fontWeight: '800',
            textAlign: 'center',
          }}
        />
      ) : (
        <View
          style={{
            minHeight: 34,
            borderRadius: 10,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
        </View>
      )}
    </View>
  );
}

function ContributionCell({
  label,
  value,
  colors,
  emphasized = false,
}: {
  label: string;
  value: number;
  colors: ThemeColors;
  emphasized?: boolean;
}) {
  return (
    <View style={{ flex: 1, minWidth: 48, gap: 3 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.textSecondary }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: emphasized ? 18 : 15,
          fontWeight: '900',
          color: emphasized ? colors.accent : colors.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}pt
      </Text>
    </View>
  );
}

function GroupPlanSummary({
  participation,
  task,
  spend,
  total,
  remaining,
  reachable,
  colors,
}: {
  participation: number;
  task: number;
  spend: number;
  total: number;
  remaining: number;
  reachable: boolean;
  colors: ThemeColors;
}) {
  const contributionTotal = participation + task + spend;
  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: colors.cardAlt,
        padding: 10,
        gap: 9,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.heading }}>
          计划贡献
        </Text>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: reachable ? colors.success : colors.textSecondary }}>
          总分 {total}pt · {reachable ? '缺口 0pt' : `缺口 ${remaining}pt`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <ContributionCell label="活动" value={participation} colors={colors} />
        <Text style={{ paddingBottom: 3, color: colors.textMuted, fontSize: 14, fontWeight: '800' }}>+</Text>
        <ContributionCell label="任务" value={task} colors={colors} />
        <Text style={{ paddingBottom: 3, color: colors.textMuted, fontSize: 14, fontWeight: '800' }}>+</Text>
        <ContributionCell label="消费" value={spend} colors={colors} />
        <Text style={{ paddingBottom: 3, color: colors.textMuted, fontSize: 14, fontWeight: '800' }}>=</Text>
        <ContributionCell label="合计" value={contributionTotal} colors={colors} emphasized />
      </View>
    </View>
  );
}

function getGroupHint(stat: ReturnType<typeof calculateUltimaGroupStats>): string {
  if (!stat.active) return '不参与此团集章';
  if (stat.complete) return '目标已达成';
  if (stat.reachable) return '按照计划可以达成';
  if (stat.plannedCount === 0) return '请先选择计划参加的活动';
  if (stat.acquired + stat.plannedCount * ULTIMA_POINT_CAP_PER_EVENT < stat.target) {
    return '当前已计划活动不足以达成目标';
  }
  return `还差 ${stat.remaining}pt，建议增加任务分或消费分`;
}

export default function UltimaStampPlannerScreen() {
  const { colors, isDark } = useAppTheme();
  const [plannerState, setPlannerState] = useState<UltimaPlannerState>(() => createDefaultUltimaPlannerState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'neutral' | 'success' | 'warning'>('neutral');
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [expiredEventsCollapsed, setExpiredEventsCollapsed] = useState(false);
  const [isUpdateNoticeDismissed, setIsUpdateNoticeDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadUltimaPlannerState(),
      loadUltimaUpdateNoticeDismissed(),
    ])
      .then(([loaded, updateNoticeDismissed]) => {
        if (!mounted) return;
        setPlannerState(loaded);
        setIsUpdateNoticeDismissed(updateNoticeDismissed);
      })
      .finally(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void saveUltimaPlannerState(plannerState);
  }, [isHydrated, plannerState]);

  const groupStats = useMemo(
    () => ULTIMA_GROUPS.map((group) => calculateUltimaGroupStats(plannerState, group.key)),
    [plannerState],
  );
  const overview = useMemo(() => calculateUltimaOverview(plannerState), [plannerState]);
  const activeGroups = useMemo(() => getActiveUltimaGroups(plannerState), [plannerState]);
  const visibleEvents = useMemo(
    () => ULTIMA_TIMETREE_EVENTS.filter((event) => getEventActiveGroupKeys(plannerState, event).length > 0),
    [plannerState],
  );
  const expiredEventCount = useMemo(
    () => visibleEvents.filter((event) => isUltimaEventExpired(event)).length,
    [visibleEvents],
  );
  const firstExpiredEventId = useMemo(
    () => visibleEvents.find((event) => isUltimaEventExpired(event))?.id,
    [visibleEvents],
  );

  const updateState = useCallback((updater: (current: UltimaPlannerState) => UltimaPlannerState) => {
    setMessage('');
    setPlannerState(updater);
  }, []);

  const handlePlanSelectedEvents = useCallback(() => {
    const { state, result } = applyUltimaAutoPlan(plannerState, { includeUnplannedEvents: false });
    setPlannerState(state);
    setMessage(result.message);
    setMessageTone(result.status === 'planned' || result.status === 'complete' ? 'success' : 'warning');
  }, [plannerState]);

  const handleAutoAddEvents = useCallback(() => {
    const { state, result } = applyUltimaAutoPlan(plannerState, {
      includeUnplannedEvents: true,
      replanSelectedEvents: false,
    });
    setPlannerState(state);
    setMessage(result.message);
    setMessageTone(result.status === 'planned' || result.status === 'complete' ? 'success' : 'warning');
  }, [plannerState]);

  const handleResetPlanned = useCallback(() => {
    setPlannerState((current) => resetUltimaPlannedEvents(current));
    setMessage('已重置计划中的活动，已参加活动保持不变');
    setMessageTone('neutral');
  }, []);

  const handleResetAll = useCallback(() => {
    Alert.alert(
      '重置所有集章规划数据？',
      '这会清空团体目标、初始分数、活动状态、任务分、消费分和自动规划设置。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置所有',
          style: 'destructive',
          onPress: () => {
            setPlannerState(createDefaultUltimaPlannerState());
            setMessage('已重置所有集章规划数据');
            setMessageTone('neutral');
          },
        },
      ],
    );
  }, []);

  const handleDismissUpdateNotice = useCallback(() => {
    setIsUpdateNoticeDismissed(true);
    void saveUltimaUpdateNoticeDismissed();
  }, []);

  const updateGroup = useCallback((groupKey: UltimaGroupKey, field: 'target' | 'baseCollected', value: string) => {
    updateState((current) => ({
      ...current,
      groups: {
        ...current.groups,
        [groupKey]: {
          ...current.groups[groupKey],
          [field]: field === 'target' ? clampUltimaTarget(value) : toPlannerNumber(value),
        },
      },
    }));
  }, [updateState]);

  const updateEventStatus = useCallback((eventId: string, status: UltimaEventPlanStatus) => {
    updateState((current) => {
      const currentPlan = getUltimaEventPlan(current, eventId);
      const entries = { ...current.entries };
      const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.id === eventId);
      if (status === 'unplanned') {
        event?.groupKeys.forEach((groupKey) => {
          const key = makeEntryKey(eventId, groupKey);
          entries[key] = {
            ...getUltimaEntry(current, eventId, groupKey),
            participation: 0,
            task: 0,
            spend: 0,
          };
        });
      }
      if (status === 'attended') {
        event?.groupKeys.forEach((groupKey) => {
          const key = makeEntryKey(eventId, groupKey);
          entries[key] = {
            ...getUltimaEntry(current, eventId, groupKey),
            participation: isUltimaEventActive(currentPlan)
              ? getUltimaEntryParticipation(current, eventId, groupKey)
              : 1,
            task: getUltimaEntryTask(current, eventId, groupKey),
          };
        });
      }
      return {
        ...current,
        entries,
        eventPlans: {
          ...current.eventPlans,
          [eventId]: {
            ...currentPlan,
            planned: status === 'planned',
            attended: status === 'attended',
            task: status === 'unplanned' ? 0 : currentPlan.task,
          },
        },
      };
    });
  }, [updateState]);

  const updateEntry = useCallback((
    eventId: string,
    groupKey: UltimaGroupKey,
    field: keyof UltimaPlannerEntry,
    value: string,
  ) => {
    updateState((current) => {
      const key = makeEntryKey(eventId, groupKey);
      const currentEntry = getUltimaEntry(current, eventId, groupKey);
      const nextEntry = {
        ...currentEntry,
        [field]: field === 'participation'
          ? clampUltimaParticipation(value)
          : field === 'task'
            ? clampUltimaTask(value)
            : field === 'spend'
              ? clampUltimaGroupSpend(current, eventId, groupKey, value)
              : toPlannerNumber(value),
      };
      if (field === 'participation' || field === 'task') {
        const stateWithNextEntry = {
          ...current,
          entries: {
            ...current.entries,
            [key]: nextEntry,
          },
        };
        nextEntry.spend = clampUltimaGroupSpend(stateWithNextEntry, eventId, groupKey, currentEntry.spend);
      }
      return {
        ...current,
        entries: {
          ...current.entries,
          [key]: nextEntry,
        },
      };
    });
  }, [updateState]);

  const updateTask = useCallback((eventId: string, value: string) => {
    updateState((current) => updateUltimaEventTask(current, eventId, toPlannerNumber(value)));
  }, [updateState]);

  if (!isHydrated) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '集章规划' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
      >
        <View style={{ gap: 10 }}>
          {!isUpdateNoticeDismissed ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.warning,
                borderRadius: 16,
                backgroundColor: colors.warningSoft,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AppIcon name="alert" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: colors.heading }}>
                  活动数据有更新，建议重新规划
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="关闭活动更新提示"
                onPress={handleDismissUpdateNotice}
                style={{ padding: 4 }}
              >
                <AppIcon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View
            style={{
              borderRadius: 16,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityState={{ expanded: infoExpanded }}
              onPress={() => setInfoExpanded((current) => !current)}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>
                  独立规划数据
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  这里的计划只用于集章估算，不会改动你的活动记录。初始分数是开始规划前已有的分数，之后参加的活动会自动计入已取得。
                </Text>
                <Text style={{ fontSize: 11.5, lineHeight: 17, fontWeight: '700', color: colors.textSecondary }}>
                  本工具仅供个人规划参考，具体规则和奖励以官方公告及现场说明为准。
                </Text>
              </View>
              <AppIcon
                name="disclosure"
                variant={infoExpanded ? 'up' : 'down'}
                size={18}
                color={colors.chevron}
              />
            </TouchableOpacity>
            {infoExpanded ? (
              <View style={{ gap: 12 }}>
                <View style={{ height: 1, backgroundColor: colors.divider }} />
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.heading }}>
                    集章规则
                  </Text>
                  <View style={{ gap: 7 }}>
                    {STAMP_RULES.map((rule, index) => (
                      <View key={rule} style={{ flexDirection: 'row', gap: 7 }}>
                        <Text style={{ width: 18, fontSize: 11.5, lineHeight: 18, fontWeight: '800', color: colors.accent }}>
                          {index + 1}.
                        </Text>
                        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 18, color: colors.textSecondary }}>
                          {rule}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.heading }}>
                    活动奖励
                  </Text>
                  <View
                    style={{
                      borderRadius: 12,
                      backgroundColor: colors.cardAlt,
                      overflow: 'hidden',
                    }}
                  >
                    {STAMP_REWARDS.map(([points, reward], index) => (
                      <View
                        key={points}
                        style={{
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: colors.divider,
                          flexDirection: 'row',
                          gap: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ width: 42, fontSize: 11.5, lineHeight: 18, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}>
                          {points}
                        </Text>
                        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 18, color: colors.text }}>
                          {reward}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <MetricCard value={`${overview.completeGroupCount}/${overview.activeGroupCount}`} label="可达成团体" colors={colors} />
            <MetricCard value={overview.selectedEventCount} label="已计划活动" colors={colors} />
            <MetricCard value={`${overview.remaining}pt`} label="总缺口" colors={colors} />
            <MetricCard value={`¥${overview.estimatedSpend}`} label="预计消费" colors={colors} />
          </View>
        </View>

        <View>
          <SectionLabel label="自动规划" />
          <View
            style={{
              borderRadius: 18,
              backgroundColor: colors.card,
              padding: 14,
              gap: 12,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.16 : 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <AutoPlanStrategyControl
              value={plannerState.autoPlanner.strategy}
              colors={colors}
              onChange={(strategy) => updateState((current) => ({
                ...current,
                autoPlanner: { ...current.autoPlanner, strategy },
              }))}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <NumberField
                label="最大任务行动分"
                value={plannerState.autoPlanner.maxTask}
                placeholder="不限"
                colors={colors}
                onChange={(value) => updateState((current) => ({
                  ...current,
                  autoPlanner: { ...current.autoPlanner, maxTask: value },
                }))}
              />
              <NumberField
                label="最大消费分"
                value={plannerState.autoPlanner.maxSpend}
                placeholder={plannerState.autoPlanner.strategy === 'minimalEventsNoSpend' ? '不使用' : '不限'}
                colors={colors}
                editable={plannerState.autoPlanner.strategy !== 'minimalEventsNoSpend'}
                onChange={(value) => updateState((current) => ({
                  ...current,
                  autoPlanner: { ...current.autoPlanner, maxSpend: value },
                }))}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={handlePlanSelectedEvents}
                style={{
                  flex: 1,
                  minWidth: 148,
                  minHeight: 42,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <AppIcon name="sparkles" size={17} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>自动规划已计划</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={handleAutoAddEvents}
                style={{
                  flex: 1,
                  minWidth: 148,
                  minHeight: 42,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.input,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <AppIcon name="addCircle" size={17} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '800' }}>自动添加活动</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="重置已规划活动"
                onPress={handleResetPlanned}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.input,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 7,
                  paddingHorizontal: 8,
                }}
              >
                <AppIcon name="refresh" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                  重置已规划
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="重置所有集章规划数据"
                onPress={handleResetAll}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.danger,
                  backgroundColor: colors.input,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 7,
                  paddingHorizontal: 8,
                }}
              >
                <AppIcon name="trash" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                  重置所有
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={{
                fontSize: 12,
                lineHeight: 18,
                fontWeight: '700',
                color: messageTone === 'success' ? colors.success : messageTone === 'warning' ? colors.warning : colors.textSecondary,
              }}
            >
              {message || `当前已计划 ${overview.selectedEventCount} 场。规划不足时会按策略从未过期的活动中补足。`}
            </Text>
          </View>
        </View>

        <View>
          <SectionLabel label="团体目标" />
          <View style={{ gap: 10 }}>
            {groupStats.map((stat) => {
              const group = getUltimaGroup(stat.groupKey);
              const hint = getGroupHint(stat);
              const statusLabel = !stat.active
                ? '不参与'
                : stat.complete
                  ? '已达成'
                  : stat.reachable
                    ? '可达成'
                    : `差 ${stat.remaining}pt`;
              const statusTone = !stat.active
                ? 'neutral'
                : stat.reachable
                  ? 'success'
                  : 'warning';
              return (
                <View
                  key={group.key}
                  style={{
                    borderRadius: 18,
                    backgroundColor: colors.card,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 20 }}>{group.emoji}</Text>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.heading }} numberOfLines={1}>
                        {group.name}
                      </Text>
                    </View>
                    <Badge
                      label={statusLabel}
                      tone={statusTone}
                      colors={colors}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <CompactNumberField
                      label="目标分数"
                      value={plannerState.groups[group.key].target}
                      colors={colors}
                      onChange={(value) => updateGroup(group.key, 'target', value)}
                    />
                    <CompactNumberField
                      label="初始分数"
                      value={plannerState.groups[group.key].baseCollected}
                      colors={colors}
                      onChange={(value) => updateGroup(group.key, 'baseCollected', value)}
                    />
                    <CompactNumberField
                      label="已取得"
                      value={stat.acquired}
                      colors={colors}
                      editable={false}
                      onChange={() => {}}
                    />
                  </View>
                  <GroupPlanSummary
                    participation={stat.participation}
                    task={stat.task}
                    spend={stat.spend}
                    total={stat.total}
                    remaining={stat.remaining}
                    reachable={stat.reachable}
                    colors={colors}
                  />
                  <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.textSecondary }}>
                    当前已纳入 {stat.eventCount} 场活动。
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: stat.reachable ? colors.success : colors.textSecondary }}>
                    {hint}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <SectionLabel label="活动选择" style={{ flex: 1, marginBottom: 0 }} />
            {expiredEventCount > 0 ? (
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityState={{ expanded: !expiredEventsCollapsed }}
                onPress={() => setExpiredEventsCollapsed((current) => !current)}
                style={{
                  minHeight: 30,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.input,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 5,
                }}
              >
                <AppIcon
                  name="disclosure"
                  variant={expiredEventsCollapsed ? 'down' : 'up'}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                  {expiredEventsCollapsed ? `展开已过期 ${expiredEventCount}` : `收起已过期 ${expiredEventCount}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ gap: 12 }}>
            {visibleEvents.map((event) => {
              const plan = getUltimaEventPlan(plannerState, event.id);
              const planStatus = getUltimaEventPlanStatus(plan);
              const isActiveEvent = isUltimaEventActive(plan);
              const isExpired = isUltimaEventExpired(event);
              const eventGroups = getEventActiveGroupKeys(plannerState, event);
              const eventSummary = eventGroups.reduce((summary, groupKey) => {
                const entry = getUltimaEntry(plannerState, event.id, groupKey);
                const participation = isActiveEvent
                  ? getUltimaEntryParticipation(plannerState, event.id, groupKey)
                  : 0;
                const task = isActiveEvent ? getUltimaEntryTask(plannerState, event.id, groupKey) : 0;
                const spend = isActiveEvent
                  ? clampUltimaGroupSpend(plannerState, event.id, groupKey, entry.spend)
                  : 0;
                return {
                  participation: summary.participation + participation,
                  task: summary.task + task,
                  spend: summary.spend + spend,
                };
              }, { participation: 0, task: 0, spend: 0 });
              const eventSpend = eventSummary.spend;
              const eventTotal = eventSummary.participation + eventSummary.task + eventSummary.spend;
              if (expiredEventsCollapsed && isExpired) {
                if (event.id !== firstExpiredEventId) return null;
                return (
                  <TouchableOpacity
                    key="expired-events-summary"
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel={`展开已过期活动，共 ${expiredEventCount} 场`}
                    onPress={() => setExpiredEventsCollapsed(false)}
                    style={{
                      borderRadius: 16,
                      backgroundColor: colors.card,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        backgroundColor: colors.warningSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="time" size={20} color={colors.warning} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={{ flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.heading }}
                          numberOfLines={1}
                        >
                          已过期活动
                        </Text>
                        <Badge label={`${expiredEventCount} 场`} tone="warning" colors={colors} />
                      </View>
                    </View>
                    <AppIcon name="disclosure" variant="down" size={16} color={colors.chevron} />
                  </TouchableOpacity>
                );
              }
              return (
                <View
                  key={event.id}
                  style={{
                    borderRadius: 18,
                    backgroundColor: colors.card,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View
                        style={{
                          width: 64,
                          minHeight: 58,
                          borderRadius: 14,
                          backgroundColor: colors.accentSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ fontSize: 17, fontWeight: '900', color: colors.accentText, fontVariant: ['tabular-nums'] }}>
                          {formatDate(event.date)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                        <Text
                          style={{ fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.heading }}
                          numberOfLines={2}
                        >
                          {event.title}
                        </Text>
                        {isExpired ? (
                          <Text style={{ marginTop: 4, fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>
                            已过期，不会被自动添加
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: colors.divider }} />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
                    <PlanStatusControl
                      value={planStatus}
                      colors={colors}
                      onChange={(status) => updateEventStatus(event.id, status)}
                    />
                    <NumberField
                      label="任务行动分"
                      value={plan.task}
                      colors={colors}
                      editable={plan.planned}
                      onChange={(value) => updateTask(event.id, value)}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {plan.attended
                      ? `已参加活动可分别填写每个团的活动分和任务分，当前消费分合计 ${eventSpend}pt。`
                      : `任务分同步到本场所有团体，当前消费分合计 ${eventSpend}pt。`}
                  </Text>

                  <View
                    style={{
                      borderRadius: 14,
                      backgroundColor: colors.cardAlt,
                      overflow: 'hidden',
                    }}
                  >
                    {eventGroups.map((groupKey, rowIndex) => {
                      const group = getUltimaGroup(groupKey);
                      const entry = getUltimaEntry(plannerState, event.id, groupKey);
                      const activityPoint = isActiveEvent
                        ? getUltimaEntryParticipation(plannerState, event.id, groupKey)
                        : 0;
                      const taskPoint = isActiveEvent ? getUltimaEntryTask(plannerState, event.id, groupKey) : 0;
                      const spendPoint = isActiveEvent
                        ? clampUltimaGroupSpend(plannerState, event.id, groupKey, entry.spend)
                        : 0;
                      return (
                        <View
                          key={groupKey}
                          style={{
                            borderTopWidth: rowIndex === 0 ? 0 : 1,
                            borderTopColor: colors.divider,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                          }}
                        >
                          <Text
                            style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', color: colors.heading }}
                            numberOfLines={1}
                          >
                            {group.emoji} {group.name}
                          </Text>
                          <PlannerPointCell
                            label="活动分"
                            value={activityPoint}
                            colors={colors}
                            editable={plan.attended}
                            onChange={(value) => updateEntry(event.id, groupKey, 'participation', value)}
                          />
                          <PlannerPointCell
                            label="任务分"
                            value={taskPoint}
                            colors={colors}
                            editable={plan.attended}
                            onChange={(value) => updateEntry(event.id, groupKey, 'task', value)}
                          />
                          <PlannerPointCell
                            label="消费分"
                            value={spendPoint}
                            colors={colors}
                            editable={isActiveEvent}
                            onChange={(value) => updateEntry(event.id, groupKey, 'spend', value)}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {activeGroups.length === 0 ? (
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            所有团体目标均为 0pt，活动列表已隐藏。
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
