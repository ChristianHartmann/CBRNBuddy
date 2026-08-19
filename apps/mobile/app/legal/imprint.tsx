import { Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';
import { CONTACT_EMAIL, MAINTAINER } from '../../constants/contact';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';

const styles = StyleSheet.create({
  text: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
});

export default function ImprintScreen() {
  return (
    <Screen>
      <Section title="Über die App">
        <Text style={styles.text}>
          <Text style={styles.bold}>CBRN-Buddy</Text>
          {'\n'}Gefahrstoff-Assistent für Feuerwehren, offline und quelloffen (AGPL-3.0).
        </Text>
      </Section>

      {(MAINTAINER || CONTACT_EMAIL) && (
        <Section title="Verantwortlich">
          <Text style={styles.text}>
            {MAINTAINER}
            {MAINTAINER && CONTACT_EMAIL ? '\n' : ''}
            {CONTACT_EMAIL}
          </Text>
        </Section>
      )}

      <Section title="Datenschutz">
        <Text style={styles.text}>
          CBRN-Buddy speichert keine personenbezogenen Daten und arbeitet offline.
          Gefahrstoff-Datenbank und Erkennungsmodell liegen auf dem Gerät. Suchanfragen,
          Scans und Berechnungen verlassen es nicht.
          {'\n\n'}Einzige Ausnahme: Die Karte im Absperrradius-Rechner lädt Kartenkacheln
          von den OpenStreetMap-Servern. Dabei wird der betrachtete Kartenausschnitt
          übertragen. Ohne Karte findet kein Netzzugriff statt.
        </Text>
      </Section>

      <Section title="Datenquellen">
        <Text style={styles.text}>
          {'\u2022'} UN-Gefahrgutliste (ADR Tabelle A, Stand ADR 2025)
          {'\n'}   Quelle: Bundesanstalt für Materialforschung und -prüfung (BAM)
          {'\n'}   - Datenbank GEFAHRGUT, tes.bam.de/TES/Navigation/DE/DGG/dgg.html
          {'\n'}   Datenlizenz Deutschland - Namensnennung - Version 2.0 (dl-de/by-2-0)
          {'\n'}{'\u2022'} ERICards (CEFIC), frei für Feuerwehren
          {'\n'}{'\u2022'} ERG 2024 (PHMSA/Transport Canada), Public Domain
          {'\n'}{'\u2022'} FwDV 7, öffentlich
        </Text>
      </Section>

      <Section title="Haftungsausschluss">
        <Text style={styles.text}>
          Diese App dient als Hilfsmittel und ersetzt nicht die Ausbildung,
          Erfahrung und Entscheidungskompetenz der Einsatzkräfte. Alle Angaben
          ohne Gewähr. Die Entscheidung im Einsatz liegt beim Einsatzleiter.
        </Text>
      </Section>
    </Screen>
  );
}
