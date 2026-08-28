import { transformFileSync } from '@babel/core';

describe('CalendarWidget compilation', () => {
  test('serializes the complete widget view for the native JavaScript runtime', () => {
    const result = transformFileSync(`${process.cwd()}/src/widgets/CalendarWidget.tsx`, {
      envName: 'development',
      caller: { name: 'metro' },
    });
    const widgetFunction = result?.code?.match(/CalendarWidgetView\s*=\s*`([^`]*)`/)?.[1];

    expect(widgetFunction).toBeDefined();
    expect(widgetFunction).toContain('props.days.slice');
    expect(widgetFunction).toContain("containerRelativeFrame({axes:'both'})");
    expect(widgetFunction).toContain('maxWidth:Infinity');
    expect(widgetFunction).toContain(
      'frame({minWidth:0,maxWidth:Infinity}),frame({height:46})',
    );
    expect(widgetFunction).toContain('frame({height:16}),padding({bottom:2})');
    expect(widgetFunction).toContain('frame({width:28,height:38})');
    expect(widgetFunction).not.toContain("'ota log'");
    expect(widgetFunction).toContain(
      'frame({width:Math.max(18,String(day.count).length*6+10),height:18}),offset({x:9,y:12})',
    );
    expect(widgetFunction).toContain("_jsx(Capsule,{modifiers:[foregroundStyle('#000000')]");
    expect(widgetFunction).toContain("foregroundStyle('#FFFFFF')");
    expect(widgetFunction).toContain('monospacedDigit()');
    expect(widgetFunction).not.toContain("background('#000000'");
    expect(widgetFunction).not.toContain("shadow({color:'#FFFFFF'");
    expect(widgetFunction).not.toMatch(/maxWidth:Infinity,height:/);
    expect(widgetFunction).not.toContain('maxWidth:10000');
    expect(widgetFunction).not.toContain('day.showDayNumber');
    expect(widgetFunction).not.toContain("background('#242127E8'");
    expect(widgetFunction).not.toContain('shadow({radius:3,x:0,y:2');
    expect(widgetFunction).not.toContain('day.hasEvent');
    expect(widgetFunction).not.toContain('day.hasDateItem');
    expect(widgetFunction).not.toContain('createCalendarWidgetTimeline');
  });
});
