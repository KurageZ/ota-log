// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  transformChekiWidgetSlotConfiguration,
} = require('../with-cheki-widget-string-slot');

const GENERATED_SWIFT = `
struct ChekiPhotoWidgetConfigurationAppIntent: WidgetConfigurationIntent {
  @Parameter(title: "分组", default: ChekiPhotoWidgetSlotEnum.group1)
  var slot: ChekiPhotoWidgetSlotEnum
}

enum ChekiPhotoWidgetSlotEnum: String, CaseIterable, AppEnum {
  case group1
  case group2
  case group3
  case group4
  case group5
  case group6

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "分组")

  static var caseDisplayRepresentations: [ChekiPhotoWidgetSlotEnum: DisplayRepresentation] = [
    .group1: DisplayRepresentation(title: "分组 1"),
    .group2: DisplayRepresentation(title: "分组 2"),
    .group3: DisplayRepresentation(title: "分组 3"),
    .group4: DisplayRepresentation(title: "分组 4"),
    .group5: DisplayRepresentation(title: "分组 5"),
    .group6: DisplayRepresentation(title: "分组 6")
  ]
}

struct ChekiPhotoWidgetTimelineEntry: TimelineEntry {}

struct ChekiPhotoWidgetEntryView: View {
  private var widgetEnvironment: [String: Any] {
    var env: [String: Any] = [:]
    env["configuration"] = [
      "slot": entry.configuration.slot.rawValue
    ]
    return env
  }
}
`;

describe('with-cheki-widget-string-slot', () => {
  test('replaces the generated AppEnum slot with stable string options', () => {
    const transformed = transformChekiWidgetSlotConfiguration(GENERATED_SWIFT);

    expect(transformed).toContain(
      '@Parameter(title: "分组", optionsProvider: ChekiPhotoWidgetSlotOptionsProvider())',
    );
    expect(transformed).toContain('var slot: String?');
    expect(transformed).toContain('IntentItem("group2", title: "分组 2")');
    expect(transformed).toContain('return "group1"');
    expect(transformed).toContain('"slot": entry.configuration.slot ?? "group1"');
    expect(transformed).not.toContain('ChekiPhotoWidgetSlotEnum');
    expect(transformed).not.toContain('AppEnum');
  });

  test('fails loudly if expo-widgets changes the generated Swift shape', () => {
    expect(() => transformChekiWidgetSlotConfiguration('struct OtherWidget {}')).toThrow(
      'Could not patch ChekiPhotoWidget slot configuration',
    );
  });
});
