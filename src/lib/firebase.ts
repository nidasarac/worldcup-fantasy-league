import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

type ExpoExtra = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

const firebaseConfig = {
  apiKey: extra.firebaseApiKey ?? "",
  authDomain: extra.firebaseAuthDomain ?? "",
  projectId: extra.firebaseProjectId ?? "",
  storageBucket: extra.firebaseStorageBucket ?? "",
  messagingSenderId: extra.firebaseMessagingSenderId ?? "",
  appId: extra.firebaseAppId ?? "",
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (value) => Boolean(value) && value !== "REPLACE_ME",
  );
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase config eksik. app.json > expo.extra alanlarını doldurman gerekiyor.",
    );
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;
  try {
    // Metro, @firebase/auth'ı react-native bundle'ına çözer (getReactNativePersistence içerir).
    // tsc ise node bundle'ını görür ve bu export'u tanımaz — require + cast ile aşıyoruz.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { getReactNativePersistence } = require("@firebase/auth") as any;
    firebaseAuth = initializeAuth(getFirebaseApp(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Hot reload veya çoklu çağrı
    firebaseAuth = getAuth(getFirebaseApp());
  }
  return firebaseAuth;
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseSetupChecklist() {
  return [
    "Firebase Authentication > Email/Password açık olmalı.",
    "Firestore Database aktif olmalı.",
    "app.json içindeki expo.extra firebase alanları console değerleriyle doldurulmalı.",
    "Users, leagues ve members koleksiyonları console'da oluşturulmuş olmalı.",
  ];
}
