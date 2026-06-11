import { Text, View } from "react-native";

import { getFirebaseSetupChecklist, isFirebaseConfigured } from "../lib/firebase";
import { AppStyles } from "../styles";

export function FirebaseSetupCard({ styles }: { styles: AppStyles }) {
  if (isFirebaseConfigured()) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Firebase</Text>
        <Text style={styles.cardTitle}>Bağlantı hazır</Text>
        <Text style={styles.cardDescription}>
          Config alanları doldurulmuş. Şimdi auth, lig ve prediction akışını
          koddan bağlayabiliriz.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>Firebase</Text>
      <Text style={styles.cardTitle}>Config bekleniyor</Text>
      <Text style={styles.cardDescription}>
        Console kurulumu tamam. app.json içindeki expo.extra alanlarını Firebase
        Web App config değerleriyle doldurman gerekiyor.
      </Text>
      {getFirebaseSetupChecklist().map((item) => (
        <Text key={item} style={styles.cardDescription}>
          • {item}
        </Text>
      ))}
    </View>
  );
}
