import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';

const ToastContext = createContext(() => {});
const VISIBLE_MS = 3500;

/**
 * Brief confirmation after an action completes ("Service created").
 * Shown at the top so it never covers the tab bar or a bottom action.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message) => {
    setToast({ id: Date.now(), message });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <ToastView key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastView({ message, onDismiss }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Animated.View style={{ opacity: progress, transform: [{ translateY }], width: '100%', maxWidth: 480 }}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`${message}. Dismiss`}
          accessibilityLiveRegion="polite"
          style={styles.toast}
        >
          <Text style={styles.mark}>✓</Text>
          <Text style={styles.message}>{message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.control,
    borderRadius: radius.sm,
  },
  mark: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700', color: colors.text, marginRight: spacing.md },
  message: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
