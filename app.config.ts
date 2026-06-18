// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppConfig = any;

const config: AppConfig = {
  name: "Football Fantasy League",
  slug: "world-cup-fantasy-league",

  // --- Versiyon ---
  // version: kullanıcıya görünen numara (App Store / Play Store'da gösterilir)
  // Güncelleme yaptığında artır: 1.0.0 → 1.1.0 (yeni özellik) veya 1.0.1 (bugfix)
  version: "1.0.5",

  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  // runtimeVersion: native kod değişmedikçe sabit tut.
  // Native modül ekler/çıkarırsan veya SDK güncellersen artır.
  runtimeVersion: "1.0.0",
  updates: {
    url: "https://u.expo.dev/5eb24740-20bf-4fdf-92f7-2b1846cc1f8a",
  },
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#0a1628",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.nnidasarac.worldcupfantasyleague",
    icon: "./assets/icon.png",
    // buildNumber: Her App Store submission'da artır (1, 2, 3...)
    // Aynı version için bile farklı buildNumber gerekir
    buildNumber: "5",
  },
  android: {
    package: "com.nnidasarac.worldcupfantasyleague",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0a1628",
    },
    // versionCode: Her Play Store submission'da artır (1, 2, 3...)
    // Tam sayı olmak zorunda
    versionCode: 2,
  },
  web: {},
  plugins: ["expo-notifications", "expo-updates"],
  extra: {
    zafronixApiKey: process.env.ZAFRONIX_API_KEY ?? "zwc_free_66f5fb7d2e78b46d0075654a",
    apiFootballKey: process.env.API_FOOTBALL_KEY ?? "60f58687dbd750ca909d449d88ec5978",
    firebaseApiKey: process.env.FIREBASE_API_KEY ?? "AIzaSyAuLV-CKkXtkriob6HI3cX2EE_mmva-EKs",
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "world-cup-26-7abeb.firebaseapp.com",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "world-cup-26-7abeb",
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "world-cup-26-7abeb.firebasestorage.app",
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "159555423849",
    firebaseAppId: process.env.FIREBASE_APP_ID ?? "1:159555423849:web:059fa02bc02a6251dedcf8",
    eas: {
      projectId: "5eb24740-20bf-4fdf-92f7-2b1846cc1f8a",
    },
  },
};

export default config;
