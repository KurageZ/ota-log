import { useColorScheme } from 'react-native';
import { EventStatus } from '../types/models';
import { AppAppearance, AppThemeId, DEFAULT_THEME_ID } from './config';
import { useThemePreferences } from './themePreferences';

type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  screen: string;
  header: string;
  card: string;
  cardAlt: string;
  cardMuted: string;
  input: string;
  inputBorder: string;
  divider: string;
  text: string;
  heading: string;
  textSecondary: string;
  textMuted: string;
  placeholder: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSofter: string;
  accentPress: string;
  accentText: string;
  accentBorder: string;
  onAccent: string;
  featureEvents: string;
  featureArtists: string;
  featureCheki: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarInactive: string;
  cityBadgeBg: string;
  cityBadgeText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  chevron: string;
  starActive: string;
  starInactive: string;
  shadow: string;
  calendarShadow: string;
  scrim: string;
  heroBg: string;
  heroText: string;
  heroEyebrow: string;
  heroSubtext: string;
  heroCalloutBg: string;
  heroCalloutBorder: string;
  heroCalloutSubtext: string;
  heroDecor: string;
  heroDecorWeak: string;
  heroDecorOshi: string;
  oshiGradient: readonly [string, string, ...string[]];
  oshiBadgeBg: string;
  oshiBadgeBgInverted: string;
  oshiBadgeBorder: string;
  oshiBadgeText: string;
  oshiBadgeTextInverted: string;
  oshiAvatarBg: string;
  oshiHeartBg: string;
  oshiHeartBorder: string;
  white: string;
  profileMenu: {
    events: string;
    artists: string;
    cheki: string;
    settings: string;
    tools: string;
    about: string;
  };
  settingsMenu: {
    profile: string;
    oshi: string;
    home: string;
    stats: string;
    appearance: string;
    theme: string;
    calendar: string;
    cheki: string;
    widget: string;
    backupExport: string;
    backupSave: string;
    backupRestore: string;
    weibo: string;
    cleanup: string;
  };
  toolsMenu: {
    planner: string;
    artistImport: string;
    external: string;
  };
  status: Record<EventStatus, { accent: string; bg: string }>;
}

type ThemeDefinition = {
  label: string;
  light: ThemeColors;
  dark: ThemeColors;
};

const classicViolet: ThemeDefinition = {
  label: 'Classic Violet',
  light: {
    screen: '#f5f3ff',
    header: '#ffffff',
    card: '#ffffff',
    cardAlt: '#f3f4f6',
    cardMuted: '#f9f9f9',
    input: '#ffffff',
    inputBorder: '#e5e7eb',
    divider: 'rgba(0,0,0,0.05)',
    text: '#111827',
    heading: '#1f1235',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    placeholder: '#9ca3af',
    accent: '#7c3aed',
    accentStrong: '#6d28d9',
    accentSoft: 'rgba(124,58,237,0.12)',
    accentSofter: 'rgba(124,58,237,0.08)',
    accentPress: 'rgba(124,58,237,0.15)',
    accentText: '#5b21b6',
    accentBorder: '#a78bfa',
    onAccent: '#ffffff',
    featureEvents: '#7c3aed',
    featureArtists: '#2563eb',
    featureCheki: '#db2777',
    tabBar: '#ffffff',
    tabBarBorder: '#e5e7eb',
    tabBarInactive: '#9ca3af',
    cityBadgeBg: 'rgba(99,102,241,0.10)',
    cityBadgeText: '#4f46e5',
    danger: '#ef4444',
    dangerSoft: 'rgba(239,68,68,0.12)',
    dangerBorder: 'rgba(239,68,68,0.25)',
    success: '#16a34a',
    successSoft: 'rgba(22,163,74,0.12)',
    warning: '#d97706',
    warningSoft: 'rgba(217,119,6,0.12)',
    info: '#2563eb',
    infoSoft: 'rgba(37,99,235,0.12)',
    chevron: '#d1d5db',
    starActive: '#facc15',
    starInactive: '#e5e7eb',
    shadow: '#000000',
    calendarShadow: '#7c3aed',
    scrim: 'rgba(0,0,0,0.55)',
    heroBg: '#6d28d9',
    heroText: '#ffffff',
    heroEyebrow: 'rgba(221,214,254,0.88)',
    heroSubtext: 'rgba(233,213,255,0.9)',
    heroCalloutBg: 'rgba(255,255,255,0.09)',
    heroCalloutBorder: 'rgba(249,168,212,0.24)',
    heroCalloutSubtext: 'rgba(251,207,232,0.92)',
    heroDecor: 'rgba(255,255,255,0.1)',
    heroDecorWeak: 'rgba(255,255,255,0.06)',
    heroDecorOshi: 'rgba(244,114,182,0.18)',
    oshiGradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5', '#2dd4bf', '#feda75'],
    oshiBadgeBg: '#db2777',
    oshiBadgeBgInverted: 'rgba(219,39,119,0.18)',
    oshiBadgeBorder: '#f9a8d4',
    oshiBadgeText: '#ffffff',
    oshiBadgeTextInverted: '#f9a8d4',
    oshiAvatarBg: 'rgba(124,58,237,0.12)',
    oshiHeartBg: '#db2777',
    oshiHeartBorder: '#ffffff',
    white: '#ffffff',
    profileMenu: {
      events: '#7c3aed',
      artists: '#2563eb',
      cheki: '#db2777',
      settings: '#2563eb',
      tools: '#d97706',
      about: '#7c3aed',
    },
    settingsMenu: {
      profile: '#7c3aed',
      oshi: '#db2777',
      home: '#7c3aed',
      stats: '#2563eb',
      appearance: '#2563eb',
      theme: '#7c3aed',
      calendar: '#7c3aed',
      cheki: '#db2777',
      widget: '#db2777',
      backupExport: '#2563eb',
      backupSave: '#16a34a',
      backupRestore: '#d97706',
      weibo: '#ef4444',
      cleanup: '#ef4444',
    },
    toolsMenu: {
      planner: '#7c3aed',
      artistImport: '#2563eb',
      external: '#d97706',
    },
    status: {
      completed: { accent: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
      planned: { accent: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
      wishlist: { accent: '#d97706', bg: 'rgba(217,119,6,0.12)' },
      cancelled: { accent: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
    },
  },
  dark: {
    screen: '#0f0a1e',
    header: '#0f0a1e',
    card: '#1e1b4b',
    cardAlt: '#1f2937',
    cardMuted: '#111827',
    input: '#1f2937',
    inputBorder: '#374151',
    divider: 'rgba(255,255,255,0.06)',
    text: '#f3f4f6',
    heading: '#f9fafb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    placeholder: '#4b5563',
    accent: '#7c3aed',
    accentStrong: '#6d28d9',
    accentSoft: 'rgba(124,58,237,0.12)',
    accentSofter: 'rgba(124,58,237,0.08)',
    accentPress: 'rgba(124,58,237,0.15)',
    accentText: '#c4b5fd',
    accentBorder: '#a78bfa',
    onAccent: '#ffffff',
    featureEvents: '#7c3aed',
    featureArtists: '#2563eb',
    featureCheki: '#db2777',
    tabBar: '#111827',
    tabBarBorder: '#1f2937',
    tabBarInactive: '#6b7280',
    cityBadgeBg: 'rgba(129,140,248,0.18)',
    cityBadgeText: '#c7d2fe',
    danger: '#ef4444',
    dangerSoft: 'rgba(239,68,68,0.18)',
    dangerBorder: 'rgba(239,68,68,0.25)',
    success: '#16a34a',
    successSoft: 'rgba(22,163,74,0.12)',
    warning: '#d97706',
    warningSoft: 'rgba(217,119,6,0.12)',
    info: '#2563eb',
    infoSoft: 'rgba(37,99,235,0.12)',
    chevron: '#4b5563',
    starActive: '#facc15',
    starInactive: '#3f3f46',
    shadow: '#000000',
    calendarShadow: '#7c3aed',
    scrim: 'rgba(0,0,0,0.55)',
    heroBg: '#6d28d9',
    heroText: '#ffffff',
    heroEyebrow: 'rgba(221,214,254,0.88)',
    heroSubtext: 'rgba(233,213,255,0.9)',
    heroCalloutBg: 'rgba(255,255,255,0.09)',
    heroCalloutBorder: 'rgba(249,168,212,0.24)',
    heroCalloutSubtext: 'rgba(251,207,232,0.92)',
    heroDecor: 'rgba(255,255,255,0.1)',
    heroDecorWeak: 'rgba(255,255,255,0.06)',
    heroDecorOshi: 'rgba(244,114,182,0.18)',
    oshiGradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5', '#2dd4bf', '#feda75'],
    oshiBadgeBg: '#db2777',
    oshiBadgeBgInverted: 'rgba(219,39,119,0.18)',
    oshiBadgeBorder: '#f9a8d4',
    oshiBadgeText: '#ffffff',
    oshiBadgeTextInverted: '#f9a8d4',
    oshiAvatarBg: 'rgba(124,58,237,0.12)',
    oshiHeartBg: '#db2777',
    oshiHeartBorder: '#ffffff',
    white: '#ffffff',
    profileMenu: {
      events: '#7c3aed',
      artists: '#2563eb',
      cheki: '#db2777',
      settings: '#2563eb',
      tools: '#d97706',
      about: '#7c3aed',
    },
    settingsMenu: {
      profile: '#7c3aed',
      oshi: '#db2777',
      home: '#7c3aed',
      stats: '#2563eb',
      appearance: '#2563eb',
      theme: '#7c3aed',
      calendar: '#7c3aed',
      cheki: '#db2777',
      widget: '#db2777',
      backupExport: '#2563eb',
      backupSave: '#16a34a',
      backupRestore: '#d97706',
      weibo: '#ef4444',
      cleanup: '#ef4444',
    },
    toolsMenu: {
      planner: '#7c3aed',
      artistImport: '#2563eb',
      external: '#d97706',
    },
    status: {
      completed: { accent: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
      planned: { accent: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
      wishlist: { accent: '#d97706', bg: 'rgba(217,119,6,0.12)' },
      cancelled: { accent: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
    },
  },
};

const monoChrome: ThemeDefinition = {
  label: '极简',
  light: {
    ...classicViolet.light,
    screen: '#eef3f8',
    header: '#eef3f8',
    card: '#ffffff',
    cardAlt: '#e6edf5',
    cardMuted: '#f0f4f8',
    input: '#ffffff',
    inputBorder: '#c8d2df',
    divider: 'rgba(16,24,40,0.12)',
    text: '#101114',
    heading: '#050609',
    textSecondary: '#5d6470',
    textMuted: '#8b919c',
    placeholder: '#9aa2ae',
    accent: '#0b63f6',
    accentStrong: '#074fbf',
    accentSoft: 'rgba(11,99,246,0.10)',
    accentSofter: 'rgba(11,99,246,0.06)',
    accentPress: 'rgba(11,99,246,0.14)',
    accentText: '#074fbf',
    accentBorder: '#8fb7ff',
    onAccent: '#ffffff',
    featureEvents: '#0b63f6',
    featureArtists: '#3768b8',
    featureCheki: '#667085',
    tabBar: '#ffffff',
    tabBarBorder: '#c8d2df',
    tabBarInactive: '#8b919c',
    cityBadgeBg: 'rgba(11,99,246,0.08)',
    cityBadgeText: '#074fbf',
    danger: '#c62828',
    dangerSoft: 'rgba(198,40,40,0.10)',
    dangerBorder: 'rgba(198,40,40,0.22)',
    success: '#10743f',
    successSoft: 'rgba(16,116,63,0.10)',
    warning: '#9a5b00',
    warningSoft: 'rgba(154,91,0,0.10)',
    info: '#0b63f6',
    infoSoft: 'rgba(11,99,246,0.10)',
    chevron: '#9aa2ae',
    starActive: '#eab308',
    starInactive: '#c8d2df',
    calendarShadow: '#0b63f6',
    heroBg: '#ffffff',
    heroText: '#050609',
    heroEyebrow: '#5d6470',
    heroSubtext: '#5d6470',
    heroCalloutBg: 'rgba(11,99,246,0.07)',
    heroCalloutBorder: 'rgba(11,99,246,0.18)',
    heroCalloutSubtext: '#074fbf',
    heroDecor: 'rgba(11,99,246,0.06)',
    heroDecorWeak: 'rgba(11,99,246,0.035)',
    heroDecorOshi: 'rgba(11,99,246,0.08)',
    oshiGradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5', '#2dd4bf', '#feda75'],
    oshiBadgeBg: '#e62475',
    oshiBadgeBgInverted: 'rgba(230,36,117,0.16)',
    oshiBadgeBorder: '#ff9bc6',
    oshiBadgeText: '#ffffff',
    oshiBadgeTextInverted: '#c2185b',
    oshiAvatarBg: 'rgba(11,99,246,0.08)',
    oshiHeartBg: '#e62475',
    profileMenu: {
      events: '#7c3aed',
      artists: '#2563eb',
      cheki: '#db2777',
      settings: '#0ea5e9',
      tools: '#d97706',
      about: '#16a34a',
    },
    settingsMenu: {
      profile: '#0ea5e9',
      oshi: '#db2777',
      home: '#7c3aed',
      stats: '#2563eb',
      appearance: '#2563eb',
      theme: '#0b63f6',
      calendar: '#7c3aed',
      cheki: '#db2777',
      widget: '#db2777',
      backupExport: '#2563eb',
      backupSave: '#16a34a',
      backupRestore: '#d97706',
      weibo: '#e11d48',
      cleanup: '#c62828',
    },
    toolsMenu: {
      planner: '#7c3aed',
      artistImport: '#2563eb',
      external: '#d97706',
    },
    status: {
      completed: { accent: '#10743f', bg: 'rgba(16,116,63,0.10)' },
      planned: { accent: '#0b63f6', bg: 'rgba(11,99,246,0.10)' },
      wishlist: { accent: '#9a5b00', bg: 'rgba(154,91,0,0.10)' },
      cancelled: { accent: '#8b919c', bg: 'rgba(139,145,156,0.12)' },
    },
  },
  dark: {
    ...classicViolet.dark,
    screen: '#090d13',
    header: '#090d13',
    card: '#171e28',
    cardAlt: '#202a38',
    cardMuted: '#111821',
    input: '#171e28',
    inputBorder: '#334154',
    divider: 'rgba(255,255,255,0.11)',
    text: '#f4f7fb',
    heading: '#ffffff',
    textSecondary: '#aeb8c7',
    textMuted: '#6f7a89',
    placeholder: '#5d6878',
    accent: '#58a4ff',
    accentStrong: '#8fc3ff',
    accentSoft: 'rgba(88,164,255,0.16)',
    accentSofter: 'rgba(88,164,255,0.09)',
    accentPress: 'rgba(88,164,255,0.20)',
    accentText: '#b7d8ff',
    accentBorder: '#58a4ff',
    onAccent: '#061323',
    featureEvents: '#58a4ff',
    featureArtists: '#8fc3ff',
    featureCheki: '#aeb8c7',
    tabBar: '#111821',
    tabBarBorder: '#334154',
    tabBarInactive: '#6f7a89',
    cityBadgeBg: 'rgba(88,164,255,0.14)',
    cityBadgeText: '#b7d8ff',
    danger: '#ff8a8a',
    dangerSoft: 'rgba(255,138,138,0.14)',
    dangerBorder: 'rgba(255,138,138,0.28)',
    success: '#5fd28b',
    successSoft: 'rgba(95,210,139,0.14)',
    warning: '#f4bd63',
    warningSoft: 'rgba(244,189,99,0.14)',
    info: '#58a4ff',
    infoSoft: 'rgba(88,164,255,0.14)',
    chevron: '#647084',
    starActive: '#facc15',
    starInactive: '#334154',
    calendarShadow: '#58a4ff',
    heroBg: '#171e28',
    heroText: '#ffffff',
    heroEyebrow: '#aeb8c7',
    heroSubtext: '#aeb8c7',
    heroCalloutBg: 'rgba(88,164,255,0.12)',
    heroCalloutBorder: 'rgba(88,164,255,0.24)',
    heroCalloutSubtext: '#b7d8ff',
    heroDecor: 'rgba(88,164,255,0.10)',
    heroDecorWeak: 'rgba(88,164,255,0.06)',
    heroDecorOshi: 'rgba(88,164,255,0.12)',
    oshiGradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5', '#2dd4bf', '#feda75'],
    oshiBadgeBg: '#e62475',
    oshiBadgeBgInverted: 'rgba(230,36,117,0.18)',
    oshiBadgeBorder: '#ff9bc6',
    oshiBadgeText: '#ffffff',
    oshiBadgeTextInverted: '#ffb4d1',
    oshiAvatarBg: 'rgba(88,164,255,0.12)',
    oshiHeartBg: '#e62475',
    oshiHeartBorder: '#171e28',
    profileMenu: {
      events: '#a78bfa',
      artists: '#60a5fa',
      cheki: '#f472b6',
      settings: '#38bdf8',
      tools: '#f4bd63',
      about: '#5fd28b',
    },
    settingsMenu: {
      profile: '#38bdf8',
      oshi: '#f472b6',
      home: '#a78bfa',
      stats: '#60a5fa',
      appearance: '#60a5fa',
      theme: '#58a4ff',
      calendar: '#a78bfa',
      cheki: '#f472b6',
      widget: '#f472b6',
      backupExport: '#60a5fa',
      backupSave: '#5fd28b',
      backupRestore: '#f4bd63',
      weibo: '#fb7185',
      cleanup: '#ff8a8a',
    },
    toolsMenu: {
      planner: '#a78bfa',
      artistImport: '#60a5fa',
      external: '#f4bd63',
    },
    status: {
      completed: { accent: '#5fd28b', bg: 'rgba(95,210,139,0.14)' },
      planned: { accent: '#58a4ff', bg: 'rgba(88,164,255,0.14)' },
      wishlist: { accent: '#f4bd63', bg: 'rgba(244,189,99,0.14)' },
      cancelled: { accent: '#6f7a89', bg: 'rgba(111,122,137,0.12)' },
    },
  },
};

const nightNeon: ThemeDefinition = {
  label: 'Night Neon',
  light: {
    ...classicViolet.light,
    screen: '#eef2f9',
    header: '#f8fbff',
    card: '#f8fbff',
    cardAlt: '#e4eaf3',
    cardMuted: '#dfe7f2',
    input: '#f8fbff',
    inputBorder: '#d5dfec',
    divider: 'rgba(18,17,22,0.06)',
    text: '#17161d',
    heading: '#17161d',
    textSecondary: '#5e6372',
    textMuted: '#9499a8',
    placeholder: '#9499a8',
    accent: '#ff5c8a',
    accentStrong: '#eb3e72',
    accentSoft: 'rgba(255,92,138,0.14)',
    accentSofter: 'rgba(255,92,138,0.08)',
    accentPress: 'rgba(255,92,138,0.16)',
    accentText: '#d93767',
    accentBorder: '#ff9db8',
    featureEvents: '#ff5c8a',
    featureArtists: '#5da9ff',
    featureCheki: '#8d79ff',
    tabBar: '#f8fbff',
    tabBarBorder: '#dce5f0',
    tabBarInactive: '#8d93a5',
    cityBadgeBg: 'rgba(93,169,255,0.12)',
    cityBadgeText: '#3f82d8',
    info: '#5da9ff',
    infoSoft: 'rgba(93,169,255,0.14)',
    calendarShadow: '#ff5c8a',
    heroBg: '#241d36',
    heroEyebrow: 'rgba(255,196,216,0.88)',
    heroSubtext: 'rgba(222,233,255,0.9)',
    heroDecorOshi: 'rgba(255,92,138,0.22)',
    oshiBadgeBg: '#ff5c8a',
    oshiBadgeBgInverted: 'rgba(255,92,138,0.18)',
    oshiBadgeBorder: '#ffb0c6',
    oshiBadgeTextInverted: '#ffb0c6',
    oshiAvatarBg: 'rgba(93,169,255,0.12)',
    oshiHeartBg: '#ff5c8a',
    profileMenu: {
      events: '#ff5c8a',
      artists: '#5da9ff',
      cheki: '#8d79ff',
      settings: '#5da9ff',
      tools: '#d97706',
      about: '#ff5c8a',
    },
    settingsMenu: {
      profile: '#ff5c8a',
      oshi: '#ff5c8a',
      home: '#8d79ff',
      stats: '#5da9ff',
      appearance: '#5da9ff',
      theme: '#ff5c8a',
      calendar: '#8d79ff',
      cheki: '#ff5c8a',
      widget: '#ff5c8a',
      backupExport: '#5da9ff',
      backupSave: '#28b67a',
      backupRestore: '#d97706',
      weibo: '#ef4444',
      cleanup: '#ef4444',
    },
    toolsMenu: {
      planner: '#8d79ff',
      artistImport: '#5da9ff',
      external: '#d97706',
    },
    status: {
      completed: { accent: '#28b67a', bg: 'rgba(40,182,122,0.12)' },
      planned: { accent: '#5da9ff', bg: 'rgba(93,169,255,0.14)' },
      wishlist: { accent: '#f3b95f', bg: 'rgba(243,185,95,0.14)' },
      cancelled: { accent: '#9499a8', bg: 'rgba(148,153,168,0.12)' },
    },
  },
  dark: {
    ...classicViolet.dark,
    screen: '#121116',
    header: '#121116',
    card: '#1c1a22',
    cardAlt: '#23212b',
    cardMuted: '#15141b',
    input: '#23212b',
    inputBorder: '#353241',
    divider: 'rgba(255,255,255,0.06)',
    text: '#f2f5fb',
    heading: '#fbfdff',
    textSecondary: '#a5acbc',
    textMuted: '#6f7585',
    placeholder: '#535968',
    accent: '#ff5c8a',
    accentStrong: '#ff3f74',
    accentSoft: 'rgba(255,92,138,0.14)',
    accentSofter: 'rgba(255,92,138,0.08)',
    accentPress: 'rgba(255,92,138,0.16)',
    accentText: '#ffb0c6',
    accentBorder: '#ff9db8',
    featureEvents: '#ff5c8a',
    featureArtists: '#5da9ff',
    featureCheki: '#a993ff',
    tabBar: '#15131a',
    tabBarBorder: '#23212b',
    tabBarInactive: '#6f7585',
    cityBadgeBg: 'rgba(93,169,255,0.16)',
    cityBadgeText: '#87c1ff',
    info: '#5da9ff',
    infoSoft: 'rgba(93,169,255,0.14)',
    chevron: '#535968',
    calendarShadow: '#ff5c8a',
    heroBg: '#1d1730',
    heroEyebrow: 'rgba(255,196,216,0.88)',
    heroSubtext: 'rgba(214,229,255,0.9)',
    heroDecorOshi: 'rgba(255,92,138,0.22)',
    oshiBadgeBg: '#ff5c8a',
    oshiBadgeBgInverted: 'rgba(255,92,138,0.18)',
    oshiBadgeBorder: '#ffb0c6',
    oshiBadgeTextInverted: '#ffb0c6',
    oshiAvatarBg: 'rgba(93,169,255,0.12)',
    oshiHeartBg: '#ff5c8a',
    profileMenu: {
      events: '#ff5c8a',
      artists: '#5da9ff',
      cheki: '#a993ff',
      settings: '#5da9ff',
      tools: '#d97706',
      about: '#ff5c8a',
    },
    settingsMenu: {
      profile: '#ff5c8a',
      oshi: '#ff5c8a',
      home: '#a993ff',
      stats: '#5da9ff',
      appearance: '#5da9ff',
      theme: '#ff5c8a',
      calendar: '#a993ff',
      cheki: '#ff5c8a',
      widget: '#ff5c8a',
      backupExport: '#5da9ff',
      backupSave: '#3fc28b',
      backupRestore: '#f3b95f',
      weibo: '#ef4444',
      cleanup: '#ef4444',
    },
    toolsMenu: {
      planner: '#a993ff',
      artistImport: '#5da9ff',
      external: '#f3b95f',
    },
    status: {
      completed: { accent: '#3fc28b', bg: 'rgba(63,194,139,0.12)' },
      planned: { accent: '#5da9ff', bg: 'rgba(93,169,255,0.14)' },
      wishlist: { accent: '#f3b95f', bg: 'rgba(243,185,95,0.14)' },
      cancelled: { accent: '#6f7585', bg: 'rgba(111,117,133,0.12)' },
    },
  },
};

export const appThemes: Record<AppThemeId, ThemeDefinition> = {
  monoChrome,
  classicViolet,
  nightNeon,
};

function resolveMode(
  appearance: AppAppearance,
  systemColorScheme: ReturnType<typeof useColorScheme>,
): ThemeMode {
  if (appearance === 'system') {
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }
  return appearance;
}

export function getAppTheme(themeId: AppThemeId, mode: ThemeMode) {
  return appThemes[themeId][mode];
}

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const {
    themeId = DEFAULT_THEME_ID,
    appearance,
    calendarWeekStart,
    calendarDisplay,
    chekiDisplayMode,
    chekiTidyMode,
    chekiFillGaps,
    isHydrated,
    setAppearance,
    setCalendarWeekStart,
    setCalendarDisplay,
    setChekiDisplayMode,
    setChekiTidyMode,
    setChekiDisplayStyle,
    setChekiFillGaps,
    setThemeId,
  } = useThemePreferences();
  const mode = resolveMode(appearance, systemColorScheme);
  const colors = getAppTheme(themeId, mode);

  return {
    themeId,
    themeLabel: appThemes[themeId].label,
    appearance,
    calendarWeekStart,
    calendarDisplay,
    chekiDisplayMode,
    chekiTidyMode,
    chekiFillGaps,
    mode,
    isDark: mode === 'dark',
    colors,
    isHydrated,
    setAppearance,
    setCalendarWeekStart,
    setCalendarDisplay,
    setChekiDisplayMode,
    setChekiTidyMode,
    setChekiDisplayStyle,
    setChekiFillGaps,
    setThemeId,
  };
}
