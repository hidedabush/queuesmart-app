// Design tokens for QueueSmart.
// Every screen imports from here so the app stays visually consistent
// as different team members build different parts.
//
// Theme: black background, white text, red accents. Red is reserved for
// "live" and "needs attention" signals so it keeps its meaning.

import { Platform } from 'react-native';

export const colors = {
  bg: '#000000',          // screen background
  surface: '#0B0B0B',     // cards, rows, inputs
  raised: '#161616',      // pressed / selected surfaces
  hover: '#111111',       // pointer hover on web
  line: '#262626',        // hairline separators
  lineStrong: '#3D3D3D',  // decorative outlines, empty meter bars
  control: '#646464',     // borders that mark an interactive boundary (3:1 on surface)

  text: '#FFFFFF',        // primary text
  muted: '#A3A3A3',       // secondary text (7.8:1 on surface)
  faint: '#7A7A7A',       // tertiary text and placeholders (4.6:1 on surface)

  accent: '#E11D2E',      // fills behind white text (buttons, switches)
  accentHover: '#CB1929',
  accentPressed: '#B5141F',
  accentText: '#FF4D5A',  // red used as text or lines on black (6:1)
  accentSoft: 'rgba(225, 29, 46, 0.14)',
  accentSoftStrong: 'rgba(225, 29, 46, 0.24)', // hover / pressed on accentSoft surfaces

  focus: '#FFFFFF',       // keyboard focus ring on web
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const fonts = {
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 2,
  md: 4,
  pill: 999,
};

// Width breakpoints. Phones are the default; larger layouts are additive.
export const layout = {
  compact: 360,   // below this: small phones (iPhone SE 1st gen, older Android)
  tablet: 768,    // two-column grids, wider gutters
  wide: 1024,     // sidebar navigation, two-column forms
  xl: 1280,       // side panels next to lists (room left after the sidebar)
  sidebar: 232,   // width of the navigation sidebar on wide screens
  readable: 720,  // max width for single-column content
  max: 1120,      // max width for multi-column content
};

// Minimum touch target on both platforms.
export const touch = 48;

export const type = {
  hero: { fontFamily: fonts.mono, fontSize: 88, fontWeight: '700', color: colors.text, letterSpacing: -4 },
  display: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, fontWeight: '500', color: colors.text },
  secondary: { fontSize: 14, fontWeight: '400', color: colors.muted, lineHeight: 20 },
  // Small uppercase monospace tag used for labels, metadata and counters.
  label: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // Sentence-case label above a form control. Easier to read than the
  // uppercase tag when the person has to act on it.
  fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  // Tabular numbers: counts, durations, anything compared down a column.
  metric: { fontFamily: fonts.mono, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
};

// Shared by the stack and tab navigators so every header looks the same.
export const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  headerTintColor: colors.accentText,
  headerShadowVisible: false,
};

// Priority is shown as a 1-3 bar meter plus a word, so it never relies on
// colour alone. Only "high" uses the red accent.
export const priorityLevels = {
  low: { level: 1, label: 'Low', hint: 'Served after other queues when they overlap.' },
  medium: { level: 2, label: 'Medium', hint: 'Standard ordering.' },
  high: { level: 3, label: 'High', hint: 'Served first when queues overlap.' },
};
