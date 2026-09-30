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
  line: '#262626',        // hairline separators
  lineStrong: '#3D3D3D',  // input borders, inactive outlines

  text: '#FFFFFF',        // primary text
  muted: '#A3A3A3',       // secondary text (8:1 on black)
  faint: '#6B6B6B',       // decorative only, never body text

  accent: '#E11D2E',      // fills behind white text (buttons, switches)
  accentText: '#FF4D5A',  // red used as text or lines on black (5.9:1)
  accentSoft: 'rgba(225, 29, 46, 0.14)',
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
};

export const radius = {
  sm: 2,
  md: 4,
  pill: 999,
};

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
  mono: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
};

// Priority is shown as a 1-3 bar meter plus a word, so it never relies on
// colour alone. Only "high" uses the red accent.
export const priorityLevels = {
  low: { level: 1, label: 'Low', hint: 'Served after other queues when they overlap.' },
  medium: { level: 2, label: 'Medium', hint: 'Standard ordering.' },
  high: { level: 3, label: 'High', hint: 'Served first when queues overlap.' },
};
