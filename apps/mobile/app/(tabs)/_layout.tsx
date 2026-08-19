import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/colors';

const ICONS = {
  search: '\u{1F50D}',
  camera: '\u{1F4F7}',
  more: '\u{2699}',
} as const;

type IconName = keyof typeof ICONS;

function TabBarIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <Text style={{ fontSize: 20, color }}>
      {ICONS[name]}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: { fontSize: 12 },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="camera" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Suche',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="search" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="more" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
