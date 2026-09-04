import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useWindowMode, type WindowMode } from '../../utils/windowMode';

/** 阅读 / 表单容器最大宽度，避免输入框和文本横跨整屏。 */
export const READING_MAX_WIDTH = 680;
/** 仪表盘容器最大宽度，允许双栏或多栏。 */
export const DASHBOARD_MAX_WIDTH = 1120;

/** 宽屏 gutter：Compact 16 → Regular 24 → Wide 32，随窗口模式提升。 */
export const ADAPTIVE_GUTTER: Record<WindowMode, number> = {
  compact: 16,
  regular: 24,
  wide: 32,
};

/**
 * 计算自适应容器的实际内容宽度（窗口宽度、最大宽度与 gutter 综合后的结果），
 * 供图表等需要精确宽度的子组件使用，避免和容器实际布局不一致。
 */
export function getAdaptiveContentWidth(
  width: number,
  mode: WindowMode,
  kind: 'reading' | 'dashboard',
): number {
  const maxWidth = kind === 'reading' ? READING_MAX_WIDTH : DASHBOARD_MAX_WIDTH;
  return Math.max(0, Math.min(width, maxWidth) - ADAPTIVE_GUTTER[mode] * 2);
}

type AdaptiveContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function AdaptiveContainer({
  children,
  style,
  kind,
}: AdaptiveContainerProps & { kind: 'reading' | 'dashboard' }) {
  const { mode } = useWindowMode();

  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: kind === 'reading' ? READING_MAX_WIDTH : DASHBOARD_MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: ADAPTIVE_GUTTER[mode],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ReadingContainer({ children, style }: AdaptiveContainerProps) {
  return (
    <AdaptiveContainer kind="reading" style={style}>
      {children}
    </AdaptiveContainer>
  );
}

export function DashboardContainer({ children, style }: AdaptiveContainerProps) {
  return (
    <AdaptiveContainer kind="dashboard" style={style}>
      {children}
    </AdaptiveContainer>
  );
}
