import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, touch } from '../theme';

const TRACK_W = 46;
const TRACK_H = 26;
const THUMB = 20;
const TRAVEL = TRACK_W - THUMB - 6;

/**
 * On/off switch drawn in the app's own colours, so it looks the same on
 * iOS, Android and web. The whole `style` area is the touch target and it is
 * a single accessible "switch" element.
 */
export default function Toggle({ value, onValueChange, label, hint, disabled = false, style }) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        position.setValue(value ? 1 : 0);
        return;
      }
      Animated.timing(position, {
        toValue: value ? 1 : 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [value, position]);

  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed, hovered }) => [
        styles.target,
        hovered && !disabled && { backgroundColor: colors.hover },
        pressed && !disabled && { backgroundColor: colors.raised },
        style,
      ]}
    >
      <View style={[styles.track, { backgroundColor: value ? colors.accent : colors.control }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: touch, minHeight: touch, alignItems: 'center', justifyContent: 'center' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
  },
});
