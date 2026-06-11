import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

export function WorldCupHero({
  styles,
  theme,
}: {
  styles: AppStyles;
  theme: ThemePalette;
}) {
  return (
    <LinearGradient
      colors={[theme.hero, theme.heroSecondary, theme.accentStrong]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.worldCupHero}
    >
      <View style={styles.heroTopRow}>
        <View style={styles.heroChip}>
          <MaterialCommunityIcons name="trophy-award" size={16} color="#fff" />
          <Text style={styles.heroChipText}>Football Fantasy</Text>
        </View>
        <Text style={styles.heroMeta}>Friends League</Text>
      </View>

      <Text style={styles.heroTitle}>Tahmin et, puan topla, arkadaşlarını geç</Text>
      <Text style={styles.heroDescription}>
        Her maç için farklı sorularla tahmin toplayan premium futbol deneyimi.
        En yüksek puanı yapan sezonu lider bitirir.
      </Text>
    </LinearGradient>
  );
}

export function EmptyCard({
  eyebrow,
  title,
  description,
  accent,
  styles,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent?: string;
  styles: AppStyles;
}) {
  return (
    <View style={[styles.card, accent ? { backgroundColor: accent } : null]}>
      <Text style={styles.cardEyebrow}>{eyebrow}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}
