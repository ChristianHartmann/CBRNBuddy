import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { COLORS } from '../constants/colors';
import type { IViewBox } from '../lib/scanner/publish-boxes';

// Draws the live detection boxes over the native camera preview. It receives finished view
// rectangles (dp) and does nothing but draw them: no camera knowledge, no per-frame image.
// Fixed slots rather than a map() over the boxes, because useAnimatedStyle wants a stable view
// identity; a changing box count would otherwise mount and unmount views at inference rate.
//
// This carried a calibration layer for a while - a sensor frame, a crosshair and a tap-to-
// measure readout - meant to turn the accuracy of the box mapping into a number. It never
// decided anything: the tap measurement was too coarse, and its sensor frame passed 0..1 where
// the transform expects sensor pixels, so it drew nothing meaningful. What did decide it was
// dumping the model input to the log and running the preview in "contain" mode, neither of
// which needs anything in this file.

export const MAX_LIVE_BOXES = 5; // how many detections are drawn at most

const BOX_STROKE = 4;

interface IPlacardOverlayProps {
  viewBoxes: SharedValue<IViewBox[]>;
  testID?: string;
}

interface IBoxSlotProps {
  index: number;
  viewBoxes: SharedValue<IViewBox[]>;
  testID?: string;
}

const BoxSlot = ({ index, viewBoxes, testID }: IBoxSlotProps) => {
  const style = useAnimatedStyle(() => {
    const box = viewBoxes.value[index];
    if (box == null) {
      return { opacity: 0, left: 0, top: 0, width: 0, height: 0 };
    }
    return { opacity: 1, left: box.x, top: box.y, width: box.width, height: box.height };
  });
  return <Animated.View testID={testID} style={[styles.box, style]} />;
};

const SLOT_INDICES = Array.from({ length: MAX_LIVE_BOXES }, (_, i) => i);

export const PlacardOverlay = ({ viewBoxes, testID }: IPlacardOverlayProps) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={testID}>
    {SLOT_INDICES.map((i) => (
      <BoxSlot
        key={i}
        index={i}
        viewBoxes={viewBoxes}
        testID={testID != null ? `${testID}-slot-${i}` : undefined}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: BOX_STROKE,
    borderColor: COLORS.secondary,
  },
});
