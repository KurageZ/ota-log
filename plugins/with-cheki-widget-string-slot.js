const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// expo-widgets 57 generates static AppEnum parameters. On affected iOS 26.5
// builds, changing such a parameter can render a red error state and then
// restore its default. Backport the newer DynamicOptionsProvider string path
// while keeping the same labels and stable group1...group6 values.
const WIDGET_SOURCE_RELATIVE_PATH = path.join(
  'ExpoWidgetsTarget',
  'ChekiPhotoWidget.swift',
);

const GENERATED_PARAMETER = `  @Parameter(title: "分组", default: ChekiPhotoWidgetSlotEnum.group1)
  var slot: ChekiPhotoWidgetSlotEnum`;

const STRING_PARAMETER = `  @Parameter(title: "分组", optionsProvider: ChekiPhotoWidgetSlotOptionsProvider())
  var slot: String?`;

const GENERATED_ENUM_START = 'enum ChekiPhotoWidgetSlotEnum: String, CaseIterable, AppEnum {';
const TIMELINE_ENTRY_START = 'struct ChekiPhotoWidgetTimelineEntry: TimelineEntry {';

const STRING_OPTIONS_PROVIDER = `struct ChekiPhotoWidgetSlotOptionsProvider: DynamicOptionsProvider {
  func results() async throws -> IntentItemCollection<String> {
    return IntentItemCollection(sections: [
      IntentItemSection(items: [
        IntentItem("group1", title: "分组 1"),
        IntentItem("group2", title: "分组 2"),
        IntentItem("group3", title: "分组 3"),
        IntentItem("group4", title: "分组 4"),
        IntentItem("group5", title: "分组 5"),
        IntentItem("group6", title: "分组 6")
      ])
    ])
  }

  func defaultResult() async -> String? {
    return "group1"
  }
}`;

function transformChekiWidgetSlotConfiguration(source) {
  const enumStart = source.indexOf(GENERATED_ENUM_START);
  const timelineEntryStart = source.indexOf(TIMELINE_ENTRY_START);
  const hasGeneratedParameter = source.includes(GENERATED_PARAMETER);
  const hasGeneratedEnvironmentValue = source.includes(
    '"slot": entry.configuration.slot.rawValue',
  );

  if (
    !hasGeneratedParameter
    || !hasGeneratedEnvironmentValue
    || enumStart === -1
    || timelineEntryStart === -1
    || timelineEntryStart <= enumStart
  ) {
    throw new Error(
      'Could not patch ChekiPhotoWidget slot configuration: expo-widgets generated an unexpected Swift source shape.',
    );
  }

  const beforeEnum = source.slice(0, enumStart);
  const fromTimelineEntry = source.slice(timelineEntryStart);

  return `${beforeEnum}${STRING_OPTIONS_PROVIDER}\n\n${fromTimelineEntry}`
    .replace(GENERATED_PARAMETER, STRING_PARAMETER)
    .replace(
      '"slot": entry.configuration.slot.rawValue',
      '"slot": entry.configuration.slot ?? "group1"',
    );
}

module.exports = function withChekiWidgetStringSlot(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const sourcePath = path.join(
        mod.modRequest.platformProjectRoot,
        WIDGET_SOURCE_RELATIVE_PATH,
      );
      const source = fs.readFileSync(sourcePath, 'utf8');
      fs.writeFileSync(sourcePath, transformChekiWidgetSlotConfiguration(source));
      return mod;
    },
  ]);
};

module.exports.transformChekiWidgetSlotConfiguration = transformChekiWidgetSlotConfiguration;
