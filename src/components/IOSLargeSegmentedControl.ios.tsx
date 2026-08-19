import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { controlSize, environment, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type {
  IOSLargeSegmentedControlChangeEvent,
  IOSLargeSegmentedControlProps,
} from './IOSLargeSegmentedControl';

/**
 * iOS 端原生活动-拍立得分段控件。
 * 社区版 SegmentedControl 不透出 SwiftUI modifier，且 style.height 会被
 * matchContents 的固有尺寸覆盖，因此这里基于 @expo/ui/swift-ui 自建，
 * 额外挂 controlSize('large') 让系统把控件放大到原生 large 尺寸。
 */
export default function IOSLargeSegmentedControl({
  values,
  selectedIndex,
  appearance,
  testID,
  onChange,
}: IOSLargeSegmentedControlProps) {
  const modifiers = [pickerStyle('segmented'), controlSize('large')];
  if (appearance) {
    modifiers.push(environment('colorScheme', appearance));
  }

  const handleSelectionChange = (selection: number) => {
    onChange({
      nativeEvent: {
        selectedSegmentIndex: selection,
        value: values[selection] ?? '',
      },
    });
  };

  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all">
      <Picker
        selection={selectedIndex}
        onSelectionChange={handleSelectionChange}
        modifiers={modifiers}
        label=""
        testID={testID}
      >
        {values.map((label, index) => (
          <Text key={index} modifiers={[tag(index)]}>
            {label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
