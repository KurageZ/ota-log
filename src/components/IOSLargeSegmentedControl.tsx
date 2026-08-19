/**
 * Android 端空壳：SwiftUI 控件只在 iOS 分支渲染，这里保证 Android bundle
 * 能解析同名导入（Android 原生侧没有注册 PickerView）。
 * props 类型定义在共享文件里，供 iOS 实现复用；tsc 未配置 moduleSuffixes，
 * 默认只会解析到本文件，因此签名必须与 iOS 端一致。
 */
export type IOSLargeSegmentedControlChangeEvent = {
  nativeEvent: {
    selectedSegmentIndex: number;
    value: string;
  };
};

export type IOSLargeSegmentedControlProps = {
  values: string[];
  selectedIndex: number;
  appearance?: 'dark' | 'light';
  testID?: string;
  onChange: (event: IOSLargeSegmentedControlChangeEvent) => void;
};

export default function IOSLargeSegmentedControl(_props: IOSLargeSegmentedControlProps) {
  return null;
}
