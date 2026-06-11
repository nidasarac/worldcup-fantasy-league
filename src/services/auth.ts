import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "../lib/firebase";
import { AppUser } from "../types/firestore";

function normalizeNickname(value: string) {
  return value.trim().toLowerCase();
}

function isEmailLogin(value: string) {
  return value.includes("@");
}

function mapAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error
      : new Error("İşlem sırasında beklenmeyen bir hata oluştu.");
  }

  switch (error.code) {
    case "auth/invalid-credential":
      return new Error("E-posta veya nickname ya da şifre hatalı.");
    case "auth/user-not-found":
      return new Error("Bu hesap bulunamadı.");
    case "auth/wrong-password":
      return new Error("Şifre hatalı.");
    case "auth/email-already-in-use":
      return new Error("Bu e-posta ile zaten bir hesap var.");
    case "auth/weak-password":
      return new Error("Şifre en az 6 karakter olmalı.");
    case "auth/invalid-email":
      return new Error("Geçerli bir e-posta adresi gir.");
    case "auth/network-request-failed":
      return new Error("Bağlantı hatası oldu. İnternetini kontrol et.");
    default:
      return new Error(error.message || "Firebase işlemi başarısız oldu.");
  }
}

async function resolveEmailFromNickname(nickname: string) {
  const db = getFirebaseDb();
  const normalizedNickname = normalizeNickname(nickname);

  const nicknameSnapshot = await getDoc(doc(db, "nicknames", normalizedNickname));
  if (nicknameSnapshot.exists()) {
    const record = nicknameSnapshot.data() as { email?: string; uid?: string };

    if (record.email) {
      return record.email;
    }

    if (record.uid) {
      const userSnapshot = await getDoc(doc(db, "users", record.uid));
      if (userSnapshot.exists()) {
        return (userSnapshot.data() as AppUser).email;
      }
    }
  }

  throw new Error("Bu nickname ile bir kullanıcı bulunamadı.");
}

export async function registerWithEmail(
  email: string,
  password: string,
  firstName: string,
  nickname: string,
) {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const normalizedNickname = normalizeNickname(nickname);

  if (!normalizedNickname) {
    throw new Error("Nickname zorunlu.");
  }

  const existingNickname = await getDoc(doc(db, "nicknames", normalizedNickname));
  if (existingNickname.exists()) {
    throw new Error("Bu nickname zaten kullanılıyor.");
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    await credential.user.getIdToken(true);

    await runTransaction(db, async (transaction) => {
      const nicknameRef = doc(db, "nicknames", normalizedNickname);
      const userRef = doc(db, "users", credential.user.uid);
      const nicknameDoc = await transaction.get(nicknameRef);

      if (nicknameDoc.exists()) {
        throw new Error("Bu nickname zaten kullanılıyor.");
      }

      transaction.set(nicknameRef, {
        uid: credential.user.uid,
        email,
        nickname: normalizedNickname,
        createdAt: serverTimestamp(),
      });

      transaction.set(userRef, {
        firstName: firstName.trim(),
        nickname: normalizedNickname,
        displayName: normalizedNickname,
        email,
        photoURL: "",
        activeLeagueId: "",
        createdAt: serverTimestamp(),
      });
    });

    await updateProfile(credential.user, { displayName: normalizedNickname });
  } catch (error) {
    await deleteUser(credential.user);
    throw mapAuthError(error);
  }

  return credential.user;
}

export async function loginWithEmail(identifier: string, password: string) {
  const auth = getFirebaseAuth();
  const loginEmail = isEmailLogin(identifier.trim())
    ? identifier.trim()
    : await resolveEmailFromNickname(identifier);

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      loginEmail,
      password,
    );
    return credential.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function logoutUser() {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export async function getCurrentUserProfile(uid: string) {
  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? (snapshot.data() as AppUser) : null;
}
