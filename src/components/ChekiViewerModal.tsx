import React from 'react';
import { Text, View } from 'react-native';
import { formatDate } from '../utils/date';
import { useAppTheme } from '../theme/appTheme';
import { ChekiViewerItem } from '../types/chekiViewer';
import { FullscreenImageViewer, type FullscreenImageTransitionOrigin } from './FullscreenImageViewer';

interface ChekiViewerModalProps {
  visible: boolean;
  items: ChekiViewerItem[];
  selectedId: string | null;
  onClose: () => void;
  onEdit: (item: ChekiViewerItem) => void;
  onDelete?: (item: ChekiViewerItem) => void;
  initialTransitionOrigin?: FullscreenImageTransitionOrigin | null;
}

function formatPrice(price: number | null): string {
  if (price == null) return '未记录价格';
  if (Number.isInteger(price)) return `¥${price}`;
  return `¥${price.toFixed(2)}`;
}

function DetailBlock({
  label,
  value,
  labelColor,
  textColor,
  backgroundColor,
  multiline,
}: {
  label: string;
  value: string;
  labelColor: string;
  textColor: string;
  backgroundColor: string;
  multiline?: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.4,
          color: labelColor,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: multiline ? 14 : 15,
          lineHeight: multiline ? 22 : 20,
          fontWeight: multiline ? '500' : '700',
          color: textColor,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ChekiDetails({ item }: { item: ChekiViewerItem }) {
  const { colors } = useAppTheme();
  const detailBlockBackgroundColor = 'rgba(255,255,255,0.07)';
  const detailLabelColor = 'rgba(255,255,255,0.66)';
  const dateText = item.date ? formatDate(item.date) : '未记录日期';
  const eventTitle = item.eventTitle ?? '未关联活动';
  const artistName = item.artistName ?? '未关联艺人';
  const notesText = item.notes?.trim() ? item.notes.trim() : '暂无备注';

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DetailBlock
            label="日期"
            value={dateText}
            labelColor={detailLabelColor}
            textColor={colors.white}
            backgroundColor={detailBlockBackgroundColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DetailBlock
            label="价格"
            value={formatPrice(item.price)}
            labelColor={detailLabelColor}
            textColor={colors.white}
            backgroundColor={detailBlockBackgroundColor}
          />
        </View>
      </View>
      <DetailBlock
        label="艺人"
        value={artistName}
        labelColor={detailLabelColor}
        textColor={colors.white}
        backgroundColor={detailBlockBackgroundColor}
      />
      <DetailBlock
        label="活动"
        value={eventTitle}
        labelColor={detailLabelColor}
        textColor={colors.white}
        backgroundColor={detailBlockBackgroundColor}
        multiline
      />
      <DetailBlock
        label="备注"
        value={notesText}
        labelColor={detailLabelColor}
        textColor={colors.white}
        backgroundColor={detailBlockBackgroundColor}
        multiline
      />
    </View>
  );
}

export function ChekiViewerModal({
  visible,
  items,
  selectedId,
  onClose,
  onEdit,
  onDelete,
  initialTransitionOrigin,
}: ChekiViewerModalProps) {
  return (
    <FullscreenImageViewer
      visible={visible}
      items={items}
      selectedId={selectedId}
      onClose={onClose}
      onEdit={(item) => {
        onClose();
        onEdit(item);
      }}
      onDelete={onDelete
        ? (item) => {
          onClose();
          onDelete(item);
        }
        : undefined}
      getDetailSummary={(item) => item.date ? formatDate(item.date) : '未记录日期'}
      renderDetails={(item) => <ChekiDetails item={item} />}
      initialTransitionOrigin={initialTransitionOrigin}
    />
  );
}
