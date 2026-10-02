import React from 'react';
import { View } from 'react-native';

// Geometric glyphs built from Views, in the same style as the priority meter.
// Always shown with a text label, so the shape only needs to be distinct.

const BAR_HEIGHTS = [0.45, 0.85, 0.3, 0.65];

export function DashboardIcon({ color, size = 22 }) {
  const plot = size - 3;
  return (
    <View style={{ width: size, height: size, justifyContent: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: plot, paddingHorizontal: 1 }}>
        {BAR_HEIGHTS.map((h, i) => (
          <View key={i} style={{ width: 3, height: Math.round(plot * h), backgroundColor: color }} />
        ))}
      </View>
      <View style={{ height: 2, marginTop: 1, backgroundColor: color }} />
    </View>
  );
}

export function ServicesIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: 3 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 4, height: 4, backgroundColor: color }} />
          <View style={{ flex: 1, height: 2, marginLeft: 4, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}
