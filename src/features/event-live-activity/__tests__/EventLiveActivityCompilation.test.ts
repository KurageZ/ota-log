import { transformFileSync } from '@babel/core';
import { runInNewContext } from 'node:vm';
import type { EventLiveActivityProps } from '../types';

interface WidgetNode {
  type: string;
  props: {
    children?: WidgetNode | WidgetNode[] | string | null;
    modifiers?: Array<{ name: string; args: unknown[] }>;
    [key: string]: unknown;
  };
}

function compileLiveActivity() {
  const result = transformFileSync(
    `${process.cwd()}/src/features/event-live-activity/EventLiveActivity.tsx`,
    { envName: 'development', caller: { name: 'metro' } },
  );
  let source = '';
  runInNewContext(result!.code!, {
    exports: {},
    require: (name: string) => name === 'expo-widgets'
      ? { createLiveActivity: (_name: string, view: string) => { source = view; } }
      : {},
  });
  expect(source).toContain('function(props,environment)');

  const element = (type: string, props: WidgetNode['props']): WidgetNode => ({ type, props });
  const components = ['HStack', 'Image', 'Spacer', 'Text', 'VStack'];
  const modifiers = [
    'accessibilityElement', 'accessibilityHint', 'accessibilityLabel', 'activityBackgroundTint',
    'aspectRatio', 'backgroundOverlay', 'clipShape', 'clipped', 'cornerRadius', 'fixedSize',
    'font', 'foregroundStyle', 'frame', 'layoutPriority', 'lineLimit', 'minimumScaleFactor',
    'monospacedDigit', 'opacity', 'padding', 'resizable', 'widgetAccentedRenderingMode',
  ];
  return runInNewContext(`(${source})`, {
    _jsx: element,
    _jsxs: element,
    _Fragment: 'Fragment',
    ...Object.fromEntries(components.map((name) => [name, name])),
    ...Object.fromEntries(modifiers.map((name) => [name, (...args: unknown[]) => ({ name, args })])),
  }) as (
    props: EventLiveActivityProps,
    environment: { colorScheme: 'light' | 'dark'; levelOfDetail?: string },
  ) => Record<string, WidgetNode | undefined>;
}

const props: EventLiveActivityProps = {
  phase: 'running',
  eventTitle: '夏日偶像联合公演',
  sessionTitle: '夜场',
  primaryTitle: '星空舞台',
  currentEntryTitle: '星空舞台',
  nextEntryTitle: '特典会',
  nextEntryInitial: '特',
  hasTimetable: true,
  nextLabel: '下一项 20:00 特典会',
  countdownTargetAt: new Date('2026-09-01T19:30:00').getTime(),
  countdownKind: 'ends',
  timerMode: 'countdown',
  updatedAt: new Date('2026-09-01T19:00:00').getTime(),
  lightBackground: '#ffffff',
  darkBackground: '#1c1c1e',
  lightAccent: '#7c3aed',
  darkAccent: '#a78bfa',
};

function descendants(node: WidgetNode | undefined): WidgetNode[] {
  if (!node) return [];
  const children = node.props.children;
  const childNodes = Array.isArray(children)
    ? children.filter((child): child is WidgetNode => typeof child === 'object' && child != null)
    : typeof children === 'object' && children != null ? [children] : [];
  return [node, ...childNodes.flatMap(descendants)];
}

describe('EventLiveActivity compilation', () => {
  test('serializes and renders all required presentations in isolation', () => {
    const render = compileLiveActivity();
    const result = render(props, { colorScheme: 'light' });
    expect(result.banner).toBeDefined();
    expect(result.bannerSmall).toBeUndefined();
    expect(result.compactLeading).toBeDefined();
    expect(result.compactTrailing).toBeDefined();
    expect(result.minimal).toBeDefined();
    expect(result.expandedLeading).toBeDefined();
    expect(result.expandedTrailing).toBeDefined();
    expect(result.expandedCenter).toBeDefined();
    expect(result.expandedBottom).toBeDefined();
    expect(result.minimal?.type).toBe('Text');
    expect(result.minimal?.props.children).toBe('星');
    expect(result.minimal?.props.timerInterval).toBeUndefined();
    expect([
      result.minimal,
      result.compactTrailing,
      ...descendants(result.banner).filter((node) => node.props.timerInterval),
      ...descendants(result.expandedTrailing).filter((node) => node.props.timerInterval),
    ].filter(Boolean).every((node) => node?.props.pauseTime === undefined)).toBe(true);
    expect(result.expandedCenter?.type).toBe('HStack');
    expect(result.expandedTrailing?.type).toBe('Spacer');
    expect(result.expandedBottom?.type).toBe('HStack');
  });

  test('uses the matching environment accent without dropping the expanded footer', () => {
    const render = compileLiveActivity();
    const dark = render(props, { colorScheme: 'dark', levelOfDetail: 'simplified' });
    expect(dark.expandedBottom).toBeDefined();
    expect(dark.expandedLeading?.type).toBe('Spacer');
    expect(dark.expandedCenter?.type).toBe('HStack');
    expect(dark.expandedBottom?.type).toBe('HStack');
  });

  test('keeps compact concise and renders shared media on the safe lock-screen path', () => {
    const render = compileLiveActivity();
    const richProps = {
      ...props,
      currentArtistAvatarUri: 'file:///widgets/live-activity/artist.jpg',
      eventImageUri: 'file:///widgets/live-activity/poster.jpg',
      lightBackground: '#ffffff',
      darkBackground: '#1c1c1e',
      nextLabel: undefined,
    } as EventLiveActivityProps;
    const result = render(richProps, { colorScheme: 'light' });

    const compactFont = result.compactTrailing?.props.modifiers?.find((modifier) => (
      modifier.name === 'font'
    ));
    expect((compactFont?.args[0] as { size: number }).size).toBeLessThanOrEqual(14);
    expect(result.compactLeading?.props.uiImage).toBe(richProps.currentArtistAvatarUri);
    expect(result.minimal?.props.uiImage).toBe(richProps.currentArtistAvatarUri);
    expect(result.compactLeading).toBe(result.minimal);
    expect(result.compactLeading?.props.modifiers?.some((modifier) => (
      modifier.name === 'padding'
    ))).toBe(false);
    expect(result.minimal?.props.modifiers?.some((modifier) => (
      modifier.name === 'padding'
    ))).toBe(false);
    expect(result.compactTrailing?.props.children).toBe('进行中');
    expect(result.compactTrailing?.props.timerInterval).toBeUndefined();
    expect(result.compactTrailing?.props.modifiers?.some((modifier) => (
      modifier.name === 'padding' || modifier.name === 'frame'
    ))).toBe(false);
    expect(result.expandedLeading?.type).toBe('Spacer');
    expect(descendants(result.expandedCenter).some((node) => (
      node.type === 'Image' && node.props.uiImage === richProps.eventImageUri
    ))).toBe(true);
    expect(descendants(result.expandedCenter).some((node) => (
      node.type === 'Image' && node.props.uiImage === richProps.currentArtistAvatarUri
    ))).toBe(true);
    expect(result.banner?.props.modifiers?.some((modifier) => (
      modifier.name === 'activityBackgroundTint'
    ))).toBe(false);
    expect(result.banner?.props.modifiers?.some((modifier) => (
      modifier.name === 'padding'
      && (modifier.args[0] as { horizontal?: number }).horizontal === 20
      && (modifier.args[0] as { vertical?: number }).vertical === 16
    ))).toBe(true);
    expect(descendants(result.expandedBottom).some((node) => (
      node.type === 'Text' && String(node.props.children).includes('更新于')
    ))).toBe(false);
  });

  test('uses the event initial when the timetable has no current entry', () => {
    const render = compileLiveActivity();
    const result = render({
      ...props,
      eventTitle: '星光祭',
      primaryTitle: '夜场',
      currentEntryTitle: undefined,
      currentArtistAvatarUri: undefined,
    }, { colorScheme: 'light' });

    expect(result.compactLeading?.props.children).toBe('星');
    expect(result.minimal?.props.children).toBe('星');
  });

  test('mirrors the expanded information hierarchy on the lock screen', () => {
    const render = compileLiveActivity();
    const richProps = {
      ...props,
      currentArtistAvatarUri: 'file:///widgets/live-activity/current-artist.jpg',
      nextArtistAvatarUri: 'file:///widgets/live-activity/next-artist.jpg',
      eventImageUri: 'file:///widgets/live-activity/poster.jpg',
    } as EventLiveActivityProps;
    const result = render(richProps, { colorScheme: 'dark' });
    const bannerNodes = descendants(result.banner);

    expect(bannerNodes.some((node) => (
      node.type === 'Image' && node.props.uiImage === richProps.eventImageUri
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === richProps.eventTitle
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === '正在进行中'
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === richProps.currentEntryTitle
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Image' && node.props.systemName === 'arrow.right'
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Image' && node.props.uiImage === richProps.nextArtistAvatarUri
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Text' && String(node.props.children).includes('更新于')
    ))).toBe(false);
    expect(bannerNodes.some((node) => node.props.modifiers?.some((modifier) => (
      modifier.name === 'frame'
      && typeof (modifier.args[0] as { maxWidth?: unknown }).maxWidth === 'number'
      && !Number.isFinite((modifier.args[0] as { maxWidth: number }).maxWidth)
    )))).toBe(false);
  });

  test('shows a live timer on the lock screen when no timetable exists', () => {
    const render = compileLiveActivity();
    const result = render({
      ...props,
      hasTimetable: false,
      currentEntryTitle: undefined,
      nextEntryTitle: undefined,
      nextEntryInitial: undefined,
    }, { colorScheme: 'light' });
    const bannerNodes = descendants(result.banner);

    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === '距结束'
    ))).toBe(true);
    expect(bannerNodes.some((node) => node.props.timerInterval)).toBe(true);
  });

  test('shows only the next-entry affordance on the lock screen during a timetable gap', () => {
    const render = compileLiveActivity();
    const result = render({
      ...props,
      currentEntryTitle: undefined,
      currentArtistAvatarUri: undefined,
    }, { colorScheme: 'dark' });
    const bannerNodes = descendants(result.banner);

    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.currentEntryTitle
    ))).toBe(false);
    expect(bannerNodes.some((node) => (
      node.type === 'Image' && node.props.systemName === 'arrow.right'
    ))).toBe(true);
    expect(bannerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.nextEntryInitial
    ))).toBe(true);
  });

  test('uses the event-first hierarchy and elapsed timer when no timetable exists', () => {
    const render = compileLiveActivity();
    const noTimetableProps = {
      ...props,
      hasTimetable: false,
      primaryTitle: props.eventTitle,
      timerMode: 'elapsed' as const,
      timerStartAt: new Date('2026-09-01T18:00:00').getTime(),
    };
    const result = render(noTimetableProps, { colorScheme: 'light' });
    const centerNodes = descendants(result.expandedCenter);

    expect(result.expandedTrailing?.type).toBe('Spacer');
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.eventTitle
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === '正在进行中'
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === '已开始'
    ))).toBe(true);
    expect(descendants(result.expandedBottom).some((node) => (
      node.type === 'Text' && node.props.children === props.sessionTitle
    ))).toBe(true);
  });

  test('replaces the expanded timetable countdown with the current entry title', () => {
    const render = compileLiveActivity();
    const result = render(props, { colorScheme: 'light' });
    const centerNodes = descendants(result.expandedCenter);

    expect(result.expandedTrailing?.type).toBe('Spacer');
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.eventTitle
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === '正在进行中'
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.currentEntryTitle
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Image'
      && node.props.systemName === 'arrow.right'
      && node.props.color === '#ffffff'
      && node.props.modifiers?.some((modifier) => (
        modifier.name === 'font'
        && (modifier.args[0] as { weight?: string }).weight === 'bold'
      ))
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.nextEntryInitial
    ))).toBe(true);
    expect(centerNodes.some((node) => node.props.timerInterval)).toBe(false);
    expect(descendants(result.expandedBottom).some((node) => (
      node.type === 'Text' && node.props.children === props.sessionTitle
    ))).toBe(true);
    expect(descendants(result.expandedBottom).some((node) => (
      node.type === 'Text' && node.props.children === props.nextLabel
    ))).toBe(false);
  });

  test('uses the next artist image instead of its initial when available', () => {
    const render = compileLiveActivity();
    const result = render({
      ...props,
      nextArtistAvatarUri: 'file:///widgets/live-activity/next-artist.jpg',
    }, { colorScheme: 'light' });
    const centerNodes = descendants(result.expandedCenter);

    expect(centerNodes.some((node) => (
      node.type === 'Image' && node.props.uiImage === 'file:///widgets/live-activity/next-artist.jpg'
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.nextEntryInitial
    ))).toBe(false);
  });

  test('shows only the next-entry affordance during a timetable gap', () => {
    const render = compileLiveActivity();
    const result = render({
      ...props,
      currentEntryTitle: undefined,
      currentArtistAvatarUri: undefined,
    }, { colorScheme: 'light' });
    const centerNodes = descendants(result.expandedCenter);

    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.currentEntryTitle
    ))).toBe(false);
    expect(centerNodes.some((node) => (
      node.type === 'Image' && node.props.systemName === 'arrow.right'
    ))).toBe(true);
    expect(centerNodes.some((node) => (
      node.type === 'Text' && node.props.children === props.nextEntryInitial
    ))).toBe(true);
  });

  test('distinguishes the opening and performance countdown states', () => {
    const render = compileLiveActivity();
    const opening = render({
      ...props,
      phase: 'upcoming',
      hasTimetable: false,
      countdownKind: 'opens',
    }, { colorScheme: 'light' });
    const performance = render({
      ...props,
      phase: 'upcoming',
      hasTimetable: false,
      countdownKind: 'starts',
    }, { colorScheme: 'light' });

    expect(descendants(opening.expandedCenter).some((node) => (
      node.type === 'Text' && node.props.children === '即将开场'
    ))).toBe(true);
    expect(descendants(opening.expandedCenter).some((node) => (
      node.type === 'Text' && node.props.children === '距开场'
    ))).toBe(true);
    expect(descendants(performance.expandedCenter).some((node) => (
      node.type === 'Text' && node.props.children === '即将开演'
    ))).toBe(true);
    expect(descendants(performance.expandedCenter).some((node) => (
      node.type === 'Text' && node.props.children === '距开演'
    ))).toBe(true);
  });

  test('maps compact trailing content to short event phases instead of a countdown', () => {
    const render = compileLiveActivity();
    const compactLabel = (overrides: Partial<EventLiveActivityProps>) => render({
      ...props,
      ...overrides,
    }, { colorScheme: 'light' }).compactTrailing?.props.children;

    expect(compactLabel({ phase: 'upcoming', countdownKind: 'opens' })).toBe('开场前');
    expect(compactLabel({ phase: 'upcoming', countdownKind: 'starts' })).toBe('开演前');
    expect(compactLabel({ phase: 'running', hasTimetable: true })).toBe('进行中');
    expect(compactLabel({
      phase: 'running',
      hasTimetable: true,
      currentEntryTitle: undefined,
      nextEntryTitle: '特典会',
    })).toBe('待下一项');
    expect(compactLabel({
      phase: 'running',
      hasTimetable: false,
      currentEntryTitle: undefined,
      nextEntryTitle: undefined,
    })).toBe('演出中');
    expect(compactLabel({ phase: 'ended' })).toBe('已结束');
  });
});
