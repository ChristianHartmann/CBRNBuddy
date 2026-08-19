export const COLORS = {
  primary: "#C62828",
  secondary: "#FF8F00",
  background: "#121212",
  surface: "#1E1E1E",
  surfaceLight: "#2C2C2C",
  text: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#666666",
  border: "#333333",
  borderLight: "#444444",
  black: "#000000",
  success: "#4CAF50",
  warning: "#FF9800",
  danger: "#F44336",
  info: "#2196F3",
} as const;

/**
 * Beaufort scale 0 to 12, calm to hurricane. Indexed by wind force, so the array
 * order carries meaning and must not be sorted.
 */
export const WIND_SCALE_COLORS = [
  "#4CAF50",
  "#66BB6A",
  "#81C784",
  "#A5D6A7",
  "#FFF176",
  "#FFD54F",
  "#FFB74D",
  "#FF9800",
  "#FF7043",
  "#F44336",
  "#E53935",
  "#C62828",
  "#B71C1C",
] as const;
