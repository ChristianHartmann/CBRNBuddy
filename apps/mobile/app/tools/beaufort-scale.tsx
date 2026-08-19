import { View, Text, FlatList, StyleSheet } from 'react-native';
import { COLORS, WIND_SCALE_COLORS } from '../../constants/colors';

interface IBeaufortLevel {
  bft: number;
  name: string;
  kmh: string;
  ms: string;
  description: string;
}

const BEAUFORT_DATA: IBeaufortLevel[] = [
  { bft: 0, name: 'Windstille', kmh: '0-1', ms: '0-0.2', description: 'Rauch steigt senkrecht auf' },
  { bft: 1, name: 'Leiser Zug', kmh: '1-5', ms: '0.3-1.5', description: 'Rauch zeigt Windrichtung an' },
  { bft: 2, name: 'Leichte Brise', kmh: '6-11', ms: '1.6-3.3', description: 'Wind im Gesicht spürbar, Blätter rascheln' },
  { bft: 3, name: 'Schwache Brise', kmh: '12-19', ms: '3.4-5.4', description: 'Dünne Zweige bewegen sich, Wimpel strecken sich' },
  { bft: 4, name: 'Mäßige Brise', kmh: '20-28', ms: '5.5-7.9', description: 'Zweige bewegen sich, loses Papier wird angehoben' },
  { bft: 5, name: 'Frische Brise', kmh: '29-38', ms: '8.0-10.7', description: 'Kleine Laubbäume schwanken' },
  { bft: 6, name: 'Starker Wind', kmh: '39-49', ms: '10.8-13.8', description: 'Starke Äste schwanken, Regenschirme schwer zu halten' },
  { bft: 7, name: 'Steifer Wind', kmh: '50-61', ms: '13.9-17.1', description: 'Ganze Bäume schwanken, Gehen gegen Wind schwierig' },
  { bft: 8, name: 'Stürmischer Wind', kmh: '62-74', ms: '17.2-20.7', description: 'Zweige brechen, Gehen erheblich erschwert' },
  { bft: 9, name: 'Sturm', kmh: '75-88', ms: '20.8-24.4', description: 'Äste brechen, kleinere Schäden an Gebäuden' },
  { bft: 10, name: 'Schwerer Sturm', kmh: '89-102', ms: '24.5-28.4', description: 'Bäume werden entwurzelt, schwere Gebäudeschäden' },
  { bft: 11, name: 'Orkanartiger Sturm', kmh: '103-117', ms: '28.5-32.6', description: 'Heftige Verwüstungen' },
  { bft: 12, name: 'Orkan', kmh: '> 117', ms: '> 32.7', description: 'Schwerste Verwüstungen und Zerstörungen' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  colorBar: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bftBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bftText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  name: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  speedText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    margin: 16,
    fontStyle: 'italic',
  },
});

const renderItem = ({ item }: { item: IBeaufortLevel }) => (
  <View style={styles.card}>
    <View style={[styles.colorBar, { backgroundColor: WIND_SCALE_COLORS[item.bft] }]} />
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <View style={[styles.bftBadge, { backgroundColor: `${WIND_SCALE_COLORS[item.bft]}33` }]}>
          <Text style={styles.bftText}>{item.bft}</Text>
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <View>
          <Text style={styles.speedText}>{item.kmh} km/h</Text>
          <Text style={styles.speedText}>{item.ms} m/s</Text>
        </View>
      </View>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  </View>
);

const keyExtractor = (item: IBeaufortLevel) => item.bft.toString();

export default function BeaufortScaleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Windstärke vor Ort abschätzen für Ausbreitungsprognose
      </Text>
      <FlatList
        data={BEAUFORT_DATA}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}
