import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { getDatabase } from '../../lib/database/connection';
import {
  getSubstancesByUnNumber,
  selectMostHazardousVariant,
  selectVariantsByKemler,
  type ISubstanceDetail,
} from '../../lib/database/hazmat-repository';
import { getERICardsByUnNumber, type IERICard } from '../../lib/database/ericard-repository';
import { HazardClassBadge } from '../../components/hazard-class-badge';
import { ERICardSection } from '../../components/ericard-section';
import { Disclaimer } from '../../components/ui/disclaimer';
import { PrimaryButton } from '../../components/ui/primary-button';
import { Screen } from '../../components/ui/screen';
import { RECOMMENDATION_DISCLAIMER } from '../../lib/disclaimers';
import { OptionChips } from '../../components/option-chips';

const parseJsonField = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.surface,
    padding: 16,
    marginBottom: 8,
  },
  substanceName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  ericardId: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});

/** Label for a variant chip, e.g. "VG II | Kemler 33". */
const variantLabel = (row: ISubstanceDetail): string => {
  const parts = [
    row.packing_group ? `VG ${row.packing_group}` : 'ohne VG',
    row.kemler_number ? `Kemler ${row.kemler_number}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
};

export default function SubstanceDetailScreen() {
  const { unNumber, kemler } = useLocalSearchParams<{ unNumber: string; kemler?: string }>();
  const router = useRouter();
  const [variants, setVariants] = useState<ISubstanceDetail[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ericards, setEricards] = useState<IERICard[]>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!unNumber) return;
    try {
      const db = getDatabase();
      // A scanned Kemler number resolves which variant is on the truck. Without it
      // every variant stays visible, preselected with the most hazardous one.
      const matching = selectVariantsByKemler(getSubstancesByUnNumber(db, unNumber), kemler ?? null);
      const preselected = selectMostHazardousVariant(matching);

      setVariants(matching);
      setSelectedIndex(preselected ? matching.indexOf(preselected) : 0);
      setEricards(getERICardsByUnNumber(db, unNumber));
      setSelectedCardIndex(0);
    } catch (err) {
      console.error('[substance-detail] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [unNumber, kemler]);

  const substance = variants[selectedIndex] ?? null;
  const ericard = ericards[selectedCardIndex] ?? null;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!substance) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\u{2753}'}</Text>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Stoff nicht gefunden
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
          Kein Eintrag fuer UN {unNumber}
        </Text>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.substanceName}>{substance.name_de}</Text>

        <OptionChips
          options={variants.map(variantLabel)}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          accessibilityLabelPrefix="Variante"
          hint={`${variants.length} Eintraege zu UN ${substance.un_number}. Vorausgewaehlt ist der gefaehrlichste.`}
        />

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>UN {substance.un_number}</Text>
          {substance.kemler_number && (
            <Text style={styles.metaText}>Kemler {substance.kemler_number}</Text>
          )}
          {substance.packing_group && (
            <Text style={styles.metaText}>VG {substance.packing_group}</Text>
          )}
        </View>
        <View style={styles.metaRow}>
          <HazardClassBadge classCode={substance.hazard_class} />
          {substance.tunnel_code && (
            <Text style={styles.metaText}>Tunnel {substance.tunnel_code}</Text>
          )}
        </View>
        <OptionChips
          options={ericards.map((entry) => `ERI-Card ${entry.ericard_id}`)}
          selectedIndex={selectedCardIndex}
          onSelect={setSelectedCardIndex}
          hint={`${ericards.length} ERI-Cards zu UN ${substance.un_number}. Sie lassen sich der Verpackungsgruppe nicht eindeutig zuordnen, daher alle zur Auswahl.`}
        />
        {ericards.length === 1 && ericard?.ericard_id && (
          <Text style={styles.ericardId}>ERI-Card: {ericard.ericard_id}</Text>
        )}
      </View>

      <PrimaryButton
        label="Absperrradius berechnen"
        onPress={() =>
          router.push({
            pathname: '/calculator/evacuation',
            params: { unNumber: substance.un_number, hazardClass: substance.hazard_class },
          })
        }
      />

      {ericard ? (
        <>
          <ERICardSection
            title="Einsatz-Massnahmen"
            icon={'\u{1F6A8}'}
            items={parseJsonField(ericard.immediate_actions)}
            defaultOpen
          />
          <ERICardSection
            title="Gefahren"
            icon={'\u{26A0}'}
            items={parseJsonField(ericard.hazards)}
          />
          <ERICardSection
            title="Persoenlicher Schutz"
            icon={'\u{1F6E1}'}
            items={parseJsonField(ericard.personal_protection)}
          />
          <ERICardSection
            title="Loeschmittel / Brandbekaempfung"
            icon={'\u{1F692}'}
            items={parseJsonField(ericard.firefighting)}
          />
          <ERICardSection
            title="Erste Hilfe"
            icon={'\u{2695}'}
            items={parseJsonField(ericard.first_aid)}
          />
          <ERICardSection
            title="Massnahmen bei Freisetzung"
            icon={'\u{1F4A7}'}
            items={parseJsonField(ericard.spillage)}
          />
          <ERICardSection
            title="Eigenschaften"
            icon={'\u{1F9EA}'}
            items={parseJsonField(ericard.physical_properties)}
          />
          <Disclaimer text={RECOMMENDATION_DISCLAIMER} />
        </>
      ) : (
        <View style={{ alignItems: 'center', marginTop: 32, paddingHorizontal: 32 }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
            Keine ERICard fuer diesen Stoff vorhanden
          </Text>
        </View>
      )}
    </Screen>
  );
}
