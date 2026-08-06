import type { ComponentProps } from 'react';
import { View } from 'react-native';
import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { Heart } from 'lucide-react-native';

export type LucideIconName = ComponentProps<typeof Lucide>['name'];

export type AppIconVariant =
  | 'active'
  | 'inactive'
  | 'selected'
  | 'unselected'
  | 'forward'
  | 'back'
  | 'up'
  | 'down';

export type AppIconName =
  | 'add'
  | 'addCircle'
  | 'addPerson'
  | 'album'
  | 'alert'
  | 'appearance'
  | 'artist'
  | 'artists'
  | 'backupDownload'
  | 'backupRestore'
  | 'backupSave'
  | 'calendar'
  | 'camera'
  | 'cheki'
  | 'checkbox'
  | 'chevron'
  | 'clearFilters'
  | 'close'
  | 'closeCircle'
  | 'dateItem'
  | 'disclosure'
  | 'document'
  | 'edit'
  | 'emptySearch'
  | 'eventDate'
  | 'eventLocation'
  | 'externalLink'
  | 'favorite'
  | 'filter'
  | 'help'
  | 'home'
  | 'homeCustomize'
  | 'image'
  | 'images'
  | 'info'
  | 'link'
  | 'login'
  | 'locked'
  | 'maintenance'
  | 'mapPin'
  | 'menuDrag'
  | 'music'
  | 'more'
  | 'navigate'
  | 'oshi'
  | 'person'
  | 'profile'
  | 'radio'
  | 'refresh'
  | 'remove'
  | 'reorder'
  | 'save'
  | 'search'
  | 'settings'
  | 'share'
  | 'sparkles'
  | 'stats'
  | 'statusCancelled'
  | 'statusCompleted'
  | 'statusPlanned'
  | 'statusWishlist'
  | 'swap'
  | 'theme'
  | 'ticket'
  | 'time'
  | 'tools'
  | 'trash'
  | 'viewSettings'
  | 'weibo'
  | 'weiboImport'
  | 'widget';

export type AppSFSymbolName = 'plus' | 'slider.horizontal.3';

type IconDefinition = {
  icon: LucideIconName;
  sfSymbol?: AppSFSymbolName;
  variants?: Partial<Record<AppIconVariant, LucideIconName>>;
};

const ICONS: Record<AppIconName, IconDefinition> = {
  add: { icon: 'plus', sfSymbol: 'plus' },
  addCircle: { icon: 'calendar-plus' },
  addPerson: { icon: 'user-plus' },
  album: { icon: 'images' },
  alert: { icon: 'alert-circle' },
  appearance: { icon: 'contrast' },
  artist: { icon: 'user-round' },
  artists: { icon: 'users' },
  backupDownload: { icon: 'download' },
  backupRestore: { icon: 'upload' },
  backupSave: { icon: 'save' },
  calendar: { icon: 'calendar' },
  camera: { icon: 'camera' },
  cheki: { icon: 'album' },
  checkbox: {
    icon: 'square',
    variants: {
      selected: 'square-check-big',
      unselected: 'square',
    },
  },
  chevron: {
    icon: 'chevron-right',
    variants: {
      back: 'chevron-left',
      down: 'chevron-down',
      forward: 'chevron-right',
      up: 'chevron-up',
    },
  },
  clearFilters: { icon: 'circle-x' },
  close: { icon: 'x' },
  closeCircle: { icon: 'circle-x' },
  dateItem: { icon: 'calendar-clock' },
  disclosure: {
    icon: 'chevron-right',
    variants: {
      back: 'chevron-left',
      down: 'chevron-down',
      forward: 'chevron-right',
      up: 'chevron-up',
    },
  },
  document: { icon: 'file-text' },
  edit: { icon: 'pencil' },
  emptySearch: { icon: 'search-x' },
  eventDate: { icon: 'calendar-days' },
  eventLocation: { icon: 'map-pin' },
  externalLink: { icon: 'external-link' },
  favorite: { icon: 'heart' },
  filter: { icon: 'list-filter' },
  help: { icon: 'circle-help' },
  home: { icon: 'home' },
  homeCustomize: { icon: 'settings-2' },
  image: { icon: 'image' },
  images: { icon: 'images' },
  info: { icon: 'info' },
  link: { icon: 'link-2' },
  login: { icon: 'log-in' },
  locked: { icon: 'lock' },
  maintenance: { icon: 'images' },
  mapPin: { icon: 'map-pin' },
  menuDrag: { icon: 'grip-vertical' },
  music: { icon: 'music' },
  more: { icon: 'ellipsis' },
  navigate: { icon: 'navigation' },
  oshi: { icon: 'heart' },
  person: { icon: 'user' },
  profile: { icon: 'user' },
  radio: {
    icon: 'circle',
    variants: {
      selected: 'circle',
      unselected: 'circle',
    },
  },
  refresh: { icon: 'refresh-cw' },
  remove: { icon: 'minus' },
  reorder: { icon: 'list' },
  save: { icon: 'save' },
  search: { icon: 'search' },
  settings: { icon: 'settings' },
  share: { icon: 'share-2' },
  sparkles: { icon: 'sparkles' },
  stats: { icon: 'chart-column' },
  statusCancelled: { icon: 'x' },
  statusCompleted: { icon: 'circle-check-big' },
  statusPlanned: { icon: 'calendar' },
  statusWishlist: { icon: 'star' },
  swap: { icon: 'arrow-left-right' },
  theme: { icon: 'palette' },
  ticket: { icon: 'ticket' },
  time: { icon: 'clock' },
  tools: { icon: 'wrench' },
  trash: { icon: 'trash-2' },
  viewSettings: { icon: 'sliders-horizontal', sfSymbol: 'slider.horizontal.3' },
  weibo: { icon: 'globe' },
  weiboImport: { icon: 'users' },
  widget: { icon: 'panels-top-left' },
};

export function getAppIconGlyph(name: AppIconName, variant?: AppIconVariant): LucideIconName {
  const definition = ICONS[name];
  return variant ? definition.variants?.[variant] ?? definition.icon : definition.icon;
}

export function getAppIconSFSymbol(name: AppIconName): AppSFSymbolName {
  const symbol = ICONS[name].sfSymbol;
  if (!symbol) throw new Error(`App icon "${name}" does not define an SF Symbol`);
  return symbol;
}

function shouldFillHeart(name: AppIconName, variant: AppIconVariant | undefined) {
  if (name === 'oshi') return true;
  if (name !== 'favorite') return false;
  return variant !== 'inactive' && variant !== 'unselected';
}

function SelectedRadioIcon({
  size,
  color,
  secondaryColor,
  style,
}: {
  size: number;
  color: ColorValue;
  secondaryColor: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const dotSize = Math.max(6, Math.round(size * 0.42));

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color,
        },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: secondaryColor,
        }}
      />
    </View>
  );
}

export function AppIcon({
  name,
  variant,
  size = 18,
  color,
  secondaryColor = '#f8fafc',
  style,
}: {
  name: AppIconName;
  variant?: AppIconVariant;
  size?: number;
  color: ColorValue;
  secondaryColor?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const icon = getAppIconGlyph(name, variant);

  if (name === 'radio' && variant === 'selected') {
    return <SelectedRadioIcon size={size} color={color} secondaryColor={secondaryColor} style={style} />;
  }

  if (shouldFillHeart(name, variant)) {
    return <Heart size={size} color={color} fill={color} strokeWidth={0} />;
  }

  return <Lucide name={icon} size={size} color={color} style={style} />;
}
