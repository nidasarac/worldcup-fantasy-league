// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppConfig = any;

const config: AppConfig = {
  name: "World Cup Fantasy League",
  slug: "world-cup-fantasy-league",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#0a1628",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.nnidasarac.worldcupfantasyleague",
    icon: "./assets/icon.png",
  },
  android: {
    package: "com.nnidasarac.worldcupfantasyleague",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0a1628",
    },
  },
  web: {},
  plugins: ["expo-notifications"],
  extra: {
    apiFootballKey: process.env.API_FOOTBALL_KEY ?? "",
    firebaseApiKey: process.env.FIREBASE_API_KEY ?? "",
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    firebaseAppId: process.env.FIREBASE_APP_ID ?? "",
    eas: {
      projectId: "5eb24740-20bf-4fdf-92f7-2b1846cc1f8a",
    },
  },
};

export default config;
