// Design tokens for QueueSmart.
// Every screen imports from here so the app stays visually consistent
// as different team members build different parts.

export const colors = {
  paper: '#F5F6F8',      // screen background
  surface: '#FFFFFF',    // cards, rows, inputs
  ink: '#16202B',        // primary text
  slate: '#5A6775',      // secondary text
  line: '#E1E5EA',       // hairline separators and input borders

  indigo: '#2F4B7C',     // primary action
  indigoSoft: '#E8EDF5', // primary action, quiet background
  green: '#2E7D52',      // open, low priority, success
  greenSoft: '#E4F1EA',
  amber: '#B0700F',      // medium priority, attention
  amberSoft: '#FAEFDC',
  red: '#B3261E',        // high priority, closed, destructive
  redSoft: '#FAE6E4',
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
  sm: 6,
  md: 10,
  pill: 999,
};

// A deliberate type scale rather than ad-hoc font sizes.
export const type = {
  display: { fontSize: 34, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, fontWeight: '400', color: colors.ink },
  secondary: { fontSize: 13, fontWeight: '400', color: colors.slate },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
};

// Priority level is a core concept from A1, so it gets one shared
// colour mapping used everywhere it appears.
export const priorityTone = {
  low: { label: 'Low priority', fg: colors.green, bg: colors.greenSoft },
  medium: { label: 'Medium priority', fg: colors.amber, bg: colors.amberSoft },
  high: { label: 'High priority', fg: colors.red, bg: colors.redSoft },
};
