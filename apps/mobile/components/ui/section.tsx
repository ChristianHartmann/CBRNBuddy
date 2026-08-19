import type { ReactNode } from 'react';
import { View, Text } from 'react-native';

import { SURFACE } from './theme';

interface ISectionProps {
  title?: string;
  children?: ReactNode;
}

/** A card on the page background, optionally headed by a title. */
export const Section = ({ title, children }: ISectionProps) => (
  <View style={SURFACE.card}>
    {title && <Text style={SURFACE.title}>{title}</Text>}
    {children}
  </View>
);
