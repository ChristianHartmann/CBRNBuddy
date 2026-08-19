import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface ICheckItem {
  id: string;
  text: string;
}

interface ISection {
  letter: string;
  title: string;
  color: string;
  items: ICheckItem[];
}

const GAMS_SECTIONS: ISection[] = [
  {
    letter: 'G',
    title: 'Gefahr erkennen',
    color: COLORS.danger,
    items: [
      { id: 'g1', text: 'Welcher Stoff? (Warntafel, Begleitpapiere, Auskunft)' },
      { id: 'g2', text: 'Welche Menge ist ausgetreten/freigesetzt?' },
      { id: 'g3', text: 'Windrichtung und -stärke beachten' },
      { id: 'g4', text: 'Ausbreitung abschätzen (Gas, Flüssigkeit, Feststoff)' },
      { id: 'g5', text: 'Gefährdete Personen / Objekte im Gefahrenbereich?' },
      { id: 'g6', text: 'Zündquellen vorhanden?' },
    ],
  },
  {
    letter: 'A',
    title: 'Absperren',
    color: COLORS.warning,
    items: [
      { id: 'a1', text: 'Gefahrenbereich absperren (Windrichtung beachten)' },
      { id: 'a2', text: 'Absperrradius festlegen (ERG / Fachberater)' },
      { id: 'a3', text: 'Zahl der Einsatzkräfte im Gefahrenbereich begrenzen' },
      { id: 'a4', text: 'Unbeteiligte Personen aus dem Gefahrenbereich entfernen' },
      { id: 'a5', text: 'Zufahrtswege für Rettungskräfte freihalten' },
    ],
  },
  {
    letter: 'M',
    title: 'Menschenrettung',
    color: COLORS.info,
    items: [
      { id: 'm1', text: 'Personen aus dem Gefahrenbereich retten' },
      { id: 'm2', text: 'Mindestschutzausrüstung: PA + Schutzkleidung' },
      { id: 'm3', text: 'Kontaminierte Personen registrieren' },
      { id: 'm4', text: 'Notdekontamination durchführen' },
      { id: 'm5', text: 'Verletztensammelstelle einrichten (außerhalb Gefahrenbereich)' },
    ],
  },
  {
    letter: 'S',
    title: 'Spezialkräfte anfordern',
    color: COLORS.success,
    items: [
      { id: 's1', text: 'ABC-Fachberater / TUIS alarmieren' },
      { id: 's2', text: 'Messauftrag erteilen (Stoffidentifikation, Konzentration)' },
      { id: 's3', text: 'Dekon-Einheit anfordern' },
      { id: 's4', text: 'Rettungsdienst (ggf. Sonder-RD) informieren' },
      { id: 's5', text: 'Polizei / Untere Wasserbehörde informieren' },
      { id: 's6', text: 'Einsatzleitung aufbauen (Führungsstruktur)' },
    ],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  letterBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  letterText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxUnchecked: {
    borderColor: COLORS.textSecondary,
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  itemTextChecked: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  resetButton: {
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  resetText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  disclaimer: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    fontStyle: 'italic',
  },
});

export default function GAMSChecklistScreen() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const reset = () => setChecked(new Set());

  const totalItems = GAMS_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = checked.size;

  return (
    <ScrollView style={styles.container}>
      {GAMS_SECTIONS.map((section) => (
        <View key={section.letter} style={styles.section}>
          <View style={[styles.sectionHeader, { backgroundColor: `${section.color}33` }]}>
            <View style={[styles.letterBadge, { backgroundColor: section.color }]}>
              <Text style={styles.letterText}>{section.letter}</Text>
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.items.map((item) => {
            const isChecked = checked.has(item.id);
            return (
              <Pressable
                key={item.id}
                style={styles.itemRow}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                accessibilityLabel={item.text}
              >
                <View style={[styles.checkbox, isChecked ? styles.checkboxChecked : styles.checkboxUnchecked]}>
                  {isChecked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                </View>
                <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable style={styles.resetButton} onPress={reset} accessibilityRole="button" accessibilityLabel="Checkliste zurücksetzen">
        <Text style={styles.resetText}>
          Zurücksetzen ({checkedCount}/{totalItems} erledigt)
        </Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Checkliste nach GAMS-Regel - ersetzt nicht die Ausbildung und Erfahrung der Einsatzkräfte.
      </Text>
    </ScrollView>
  );
}
