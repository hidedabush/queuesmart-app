import { useWindowDimensions } from 'react-native';
import { layout, spacing } from '../theme';

/**
 * Breakpoint flags and the matching horizontal gutter, so every screen
 * adapts at the same widths.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= layout.tablet;

  return {
    width,
    height,
    isCompact: width < layout.compact,
    isTablet,
    isWide: width >= layout.wide,
    isXL: width >= layout.xl,
    gutter: isTablet ? spacing.xl : spacing.lg,
  };
}

// Centres a scroll view's content and caps its width on large screens.
export function contentWidth(maxWidth, gutter) {
  return { width: '100%', maxWidth: maxWidth + gutter * 2, alignSelf: 'center', paddingHorizontal: gutter };
}
