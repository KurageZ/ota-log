import { transformFileSync } from '@babel/core';
import { runInNewContext } from 'node:vm';
import type { NextEventWidgetProps } from '../NextEventWidget';

interface WidgetNode {
  type: string;
  props: {
    children?: WidgetNode | WidgetNode[] | string | (string | null)[];
    modifiers?: { name: string; args: unknown[] }[];
    alignment?: string;
    spacing?: number;
    minLength?: number;
    uiImage?: string;
  };
}

// Execute the actual serialized view with lightweight native view descriptors.
// This checks widget-runtime compatibility and structure, not pixel layout.
function compileWidget() {
  const result = transformFileSync(`${process.cwd()}/src/widgets/NextEventWidget.tsx`, {
    envName: 'development',
    caller: { name: 'metro' },
  });
  let source = '';
  runInNewContext(result!.code!, {
    exports: {},
    require: (name: string) => name === 'expo-widgets'
      ? { createWidget: (_name: string, view: string) => { source = view; } }
      : {},
  });
  expect(source).toContain('function(props,environment)');

  const element = (type: string, props: WidgetNode['props']): WidgetNode => ({ type, props });
  const components = ['HStack', 'Image', 'Spacer', 'Text', 'VStack', 'ZStack'];
  const modifiers = [
    'accessibilityElement', 'accessibilityHint', 'accessibilityLabel', 'containerBackground', 'font',
    'foregroundStyle', 'frame', 'aspectRatio', 'cornerRadius', 'fixedSize',
    'layoutPriority', 'lineLimit', 'minimumScaleFactor', 'multilineTextAlignment', 'padding',
    'resizable', 'widgetAccentedRenderingMode', 'widgetURL',
  ];
  return runInNewContext(`(${source})`, {
    _jsx: element,
    _jsxs: element,
    ...Object.fromEntries(components.map((name) => [name, name])),
    ...Object.fromEntries(modifiers.map((name) => [name, (...args: unknown[]) => ({ name, args })])),
  }) as (props: NextEventWidgetProps, environment: { widgetFamily: string; colorScheme: string }) => WidgetNode;
}

function children(node: WidgetNode): WidgetNode[] {
  const value = node.props.children;
  return (Array.isArray(value) ? value : [value])
    .filter((child): child is WidgetNode => typeof child === 'object' && child !== null);
}

function texts(node: WidgetNode): string[] {
  if (node.type === 'Text') {
    return [Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children)];
  }
  return children(node).flatMap(texts);
}

const base: NextEventWidgetProps = {
  eventId: 'event-1',
  title: '夏日偶像联合公演 上海站 · 特别场',
  countdown: '100天后',
  eventDate: '2026-12-31',
  openTime: '18:00',
  startTime: '18:30',
  city: '上海',
  venue: 'MAO Livehouse',
  imageUri: 'file:///poster.jpg',
  deepLink: 'otalog:///events/event-1',
};

describe('NextEventWidget compilation and layout', () => {
  let render: ReturnType<typeof compileWidget>;

  beforeAll(() => { render = compileWidget(); });

  test.each([
    { colorScheme: 'light', background: '#FCFBF9', date: '#8B5B4D', text: '#4F3028', secondary: '#806153' },
    { colorScheme: 'dark', background: '#1C1C1E', date: '#D9AE98', text: '#F5F1ED', secondary: '#BDB3AC' },
  ])('both sizes adapt every text role and the empty state to $colorScheme', (palette) => {
    for (const widgetFamily of ['systemSmall', 'systemMedium']) {
      const environment = { widgetFamily, colorScheme: palette.colorScheme };
      const root = render(base, environment);
      const details = widgetFamily === 'systemMedium' ? children(children(root)[0])[1] : children(root)[0];
      const [header, , title, , footer] = children(details);
      expect(root.props.modifiers).toContainEqual({ name: 'containerBackground', args: [palette.background, 'widget'] });
      expect(children(header)[0].props.modifiers).toContainEqual({ name: 'foregroundStyle', args: [palette.date] });
      expect(title.props.modifiers).toContainEqual({ name: 'foregroundStyle', args: [palette.text] });
      for (const text of [children(header)[1], ...children(footer)]) {
        expect(text.props.modifiers).toContainEqual({ name: 'foregroundStyle', args: [palette.secondary] });
      }

      const empty = render({}, environment);
      expect(empty.props.modifiers).toContainEqual({ name: 'containerBackground', args: [palette.background, 'widget'] });
      const [emptyTitle, emptyHint] = children(children(empty)[0]);
      expect(emptyTitle.props.modifiers).toContainEqual({ name: 'foregroundStyle', args: [palette.text] });
      expect(emptyHint.props.modifiers).toContainEqual({ name: 'foregroundStyle', args: [palette.secondary] });
    }
  });

  test.each(['light', 'dark'])('small stacks a centered date and weekday, title, and event details with breathing room (%s)', (colorScheme) => {
    const root = render(base, { widgetFamily: 'systemSmall', colorScheme });
    const layout = children(root)[0];
    const [header, upperSpacer, title, lowerSpacer, footer] = children(layout);

    expect(layout.type).toBe('VStack');
    expect(layout.props.alignment).toBe('center');
    expect(layout.props.spacing).toBe(6);
    expect(layout.props.modifiers).toContainEqual({ name: 'padding', args: [{ horizontal: 14, vertical: 20 }] });
    expect(header.type).toBe('HStack');
    expect(header.props.alignment).toBe('firstTextBaseline');
    expect(texts(header)).toEqual(['12月31日', '周四']);
    expect(header.props.modifiers).toEqual(expect.arrayContaining([
      { name: 'accessibilityElement', args: ['ignore'] },
      { name: 'accessibilityLabel', args: ['12月31日 周四'] },
      { name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, alignment: 'center' }] },
    ]));
    expect(children(header)[0].props.modifiers).toEqual(expect.arrayContaining([
      { name: 'font', args: [{ size: 24, weight: 'bold' }] },
      { name: 'lineLimit', args: [1] },
      { name: 'minimumScaleFactor', args: [0.8] },
    ]));
    expect(children(header)[1].props.modifiers).toContainEqual({ name: 'font', args: [{ size: 12, weight: 'medium' }] });
    expect(title.type).toBe('Text');
    expect(texts(title)).toEqual([base.title]);
    expect(title.props.modifiers).toEqual(expect.arrayContaining([
      { name: 'lineLimit', args: [2] },
      { name: 'font', args: [{ size: 14, weight: 'medium' }] },
      { name: 'multilineTextAlignment', args: ['center'] },
      { name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, alignment: 'center' }] },
    ]));
    expect(upperSpacer.type).toBe('Spacer');
    expect(upperSpacer.props.minLength).toBe(0);
    expect(lowerSpacer).toEqual(upperSpacer);
    expect(footer.props.alignment).toBe('center');
    expect(footer.props.modifiers).toContainEqual({ name: 'layoutPriority', args: [1] });
    expect(texts(footer)).toEqual(['18:00 开场', 'MAO Livehouse']);
    expect(children(footer)[1].props.modifiers).toContainEqual({ name: 'lineLimit', args: [1] });
    expect(texts(root)).toEqual(['12月31日', '周四', base.title, '18:00 开场', 'MAO Livehouse']);
    expect(root.props.modifiers).toContainEqual({ name: 'widgetURL', args: [base.deepLink] });
  });

  test.each([
    { openTime: '18:00', startTime: null, expected: ['18:00 开场', 'MAO Livehouse'] },
    { openTime: null, startTime: '18:30', expected: ['18:30 开演', 'MAO Livehouse'] },
    { openTime: null, startTime: null, expected: ['全天', 'MAO Livehouse'] },
    { openTime: '', startTime: '', expected: ['全天', 'MAO Livehouse'] },
  ])('small handles partial and missing times: $expected', ({ expected, ...times }) => {
    const root = render({ ...base, ...times }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    expect(texts(children(children(root)[0])[4])).toEqual(expected);
  });

  test.each(['今天', '明天', '100天后', undefined])('small replaces countdown %s with the calendar date', (countdown) => {
    const root = render({ ...base, countdown }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    const header = children(children(root)[0])[0];
    expect(texts(header)).toEqual(['12月31日', '周四']);
  });

  test.each([
    { eventDate: '2026-09-05', expected: ['9月5日', '周六'] },
    { eventDate: '2026-09-06', expected: ['9月6日', '周日'] },
    { eventDate: '2026-09-07', expected: ['9月7日', '周一'] },
    { eventDate: '2028-02-29', expected: ['2月29日', '周二'] },
    { eventDate: '2026-09-09', expected: ['9月9日', '周三'] },
    { eventDate: '2026-12-31', expected: ['12月31日', '周四'] },
    { eventDate: '2027-01-01', expected: ['1月1日', '周五'] },
    { eventDate: undefined, expected: ['日期待确认'] },
    { eventDate: '', expected: ['日期待确认'] },
    { eventDate: 'invalid-date-value', expected: ['日期待确认'] },
    { eventDate: '2026-02-29', expected: ['日期待确认'] },
    { eventDate: '2026-13-01', expected: ['日期待确认'] },
  ])('small formats the calendar date without a year: $eventDate', ({ eventDate, expected }) => {
    const root = render({ ...base, eventDate }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    const header = children(children(root)[0])[0];
    expect(texts(header)).toEqual(expected);
    expect(header.props.modifiers).toContainEqual({ name: 'accessibilityLabel', args: [expected.join(' ')] });
  });

  test.each([
    { city: '上海', venue: null, expected: [] },
    { city: null, venue: 'MAO Livehouse', expected: ['MAO Livehouse'] },
    { city: null, venue: null, expected: [] },
    { city: '', venue: '', expected: [] },
    { city: '上海', venue: '  ', expected: [] },
    { city: '上海', venue: ' MAO Livehouse ', expected: ['MAO Livehouse'] },
    { city: '上海', venue: '这是一个很长的演出场馆名称 · 二楼特别舞台', expected: ['这是一个很长的演出场馆名称 · 二楼特别舞台'] },
  ])('small handles partial, missing, and long locations: $expected', ({ expected, ...location }) => {
    const root = render({ ...base, ...location }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    expect(texts(children(children(root)[0])[4])).toEqual(['18:00 开场', ...expected]);
  });

  test.each([
    { title: '生日公演', venue: base.venue },
    { title: base.title, venue: base.venue },
    { title: '这是一个很长的活动标题 · 特别纪念联合公演 上海站', venue: null },
  ])('small balances space around the title for varying content: $title', (content) => {
    const root = render({ ...base, ...content }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    const layout = children(root)[0];
    const nodes = children(layout);
    expect(nodes.map((node) => node.type)).toEqual(['HStack', 'Spacer', 'Text', 'Spacer', 'VStack']);
    expect(layout.props.spacing).toBe(6);
    expect(nodes[1].props).toEqual({ minLength: 0 });
    expect(nodes[3].props).toEqual(nodes[1].props);
    expect(texts(nodes[2])).toEqual([content.title]);
  });

  test.each([base.imageUri, undefined, ''])('medium shows an optional poster and a full-height preview (image: %s)', (imageUri) => {
    const root = render({ ...base, imageUri }, { widgetFamily: 'systemMedium', colorScheme: 'light' });
    const layout = children(root)[0];
    const nodes = children(layout);
    const details = nodes[nodes.length - 1];
    expect(layout.type).toBe('HStack');
    expect(layout.props.spacing).toBe(16);
    expect(layout.props.modifiers).toEqual([
      { name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity }] },
      { name: 'padding', args: [{ all: 20 }] },
    ]);
    expect(nodes).toHaveLength(imageUri ? 2 : 1);
    if (imageUri) {
      const poster = nodes[0];
      expect(poster.type).toBe('Image');
      expect(poster.props.uiImage).toBe(imageUri);
      expect(poster.props.modifiers).toEqual([
        { name: 'resizable', args: [] },
        { name: 'aspectRatio', args: [{ contentMode: 'fit' }] },
        { name: 'cornerRadius', args: [12] },
        { name: 'frame', args: [{ width: 96, minHeight: 0, maxHeight: Infinity, alignment: 'leading' }] },
        { name: 'widgetAccentedRenderingMode', args: ['fullColor'] },
      ]);
    }
    expect(details.type).toBe('VStack');
    expect(details.props.alignment).toBe('leading');
    expect(details.props.modifiers).toEqual([
      { name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity, alignment: 'leading' }] },
      { name: 'padding', args: [{ top: 4 }] },
    ]);
    const [header, upperSpacer, title, lowerSpacer, footer] = children(details);
    expect(children(details).map((node) => node.type)).toEqual(['HStack', 'Spacer', 'Text', 'Spacer', 'VStack']);
    expect(details.props.spacing).toBe(6);
    expect(upperSpacer.props).toEqual({ minLength: 0 });
    expect(lowerSpacer).toEqual(upperSpacer);
    expect(header.props.modifiers).toContainEqual({ name: 'accessibilityLabel', args: ['12月31日 周四'] });
    expect(header.props.modifiers).toContainEqual({ name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, alignment: 'center' }] });
    expect(children(header)[0].props.modifiers).toContainEqual({ name: 'font', args: [{ size: 22, weight: 'bold' }] });
    expect(children(header)[1].props.modifiers).toContainEqual({ name: 'font', args: [{ size: 12, weight: 'medium' }] });
    expect(title.props.modifiers).toEqual(expect.arrayContaining([
      { name: 'font', args: [{ size: 16, weight: 'medium' }] },
      { name: 'lineLimit', args: [2] },
      { name: 'multilineTextAlignment', args: ['leading'] },
      { name: 'frame', args: [{ minWidth: 0, maxWidth: Infinity, alignment: 'leading' }] },
    ]));
    expect(footer.props.alignment).toBe('leading');
    expect(footer.props.modifiers).toContainEqual({ name: 'layoutPriority', args: [1] });
    for (const text of children(footer)) {
      expect(text.props.modifiers).toContainEqual({ name: 'lineLimit', args: [1] });
    }
    expect(texts(details)).toEqual([
      '12月31日', '周四', base.title, '18:00 开场 · 18:30 开演', 'MAO Livehouse',
    ]);
    expect(texts(root)).not.toContain(base.countdown);
    expect(root.props.modifiers).toContainEqual({ name: 'widgetURL', args: [base.deepLink] });
  });

  test.each([
    { openTime: '18:00', startTime: null, venue: 'MAO Livehouse', expected: ['18:00 开场', 'MAO Livehouse'] },
    { openTime: null, startTime: '18:30', venue: 'MAO Livehouse', expected: ['18:30 开演', 'MAO Livehouse'] },
    { openTime: null, startTime: null, venue: null, expected: ['全天'] },
    { openTime: '', startTime: '', venue: '  ', expected: ['全天'] },
    { openTime: '18:00', startTime: '18:30', venue: ' MAO Livehouse ', expected: ['18:00 开场 · 18:30 开演', 'MAO Livehouse'] },
    { openTime: null, startTime: null, venue: '这是一个很长的演出场馆名称 · 二楼特别舞台', expected: ['全天', '这是一个很长的演出场馆名称 · 二楼特别舞台'] },
  ])('medium handles partial times and venue-only locations: $expected', ({ expected, ...props }) => {
    const root = render({ ...base, ...props }, { widgetFamily: 'systemMedium', colorScheme: 'light' });
    const details = children(children(root)[0])[1];
    expect(texts(children(details)[4])).toEqual(expected);
  });

  test.each(['2026-09-06', '2027-01-01', undefined, '2026-02-29'])('medium shares the date and weekday with small: %s', (eventDate) => {
    const medium = render({ ...base, eventDate }, { widgetFamily: 'systemMedium', colorScheme: 'light' });
    const small = render({ ...base, eventDate }, { widgetFamily: 'systemSmall', colorScheme: 'light' });
    expect(texts(children(children(children(medium)[0])[1])[0])).toEqual(texts(children(children(small)[0])[0]));
  });

  test.each(['systemSmall', 'systemMedium'])('preserves the empty state and create link (%s)', (widgetFamily) => {
    const root = render({}, { widgetFamily, colorScheme: 'light' });
    expect(texts(root)).toEqual(['还没有下一场活动', '轻点添加计划中的活动']);
    expect(root.props.modifiers).toContainEqual({ name: 'widgetURL', args: ['otalog:///events/compose'] });
  });
});
