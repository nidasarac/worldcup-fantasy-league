import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebase";
import { AppUser, League, LeagueMember } from "../types/firestore";

export async function getLeagueById(leagueId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "leagues", leagueId));
  return snapshot.exists() ? (snapshot.data() as League) : null;
}

export async function getLeagueMembers(leagueId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, "leagues", leagueId, "members")),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as LeagueMember),
  }));
}

export async function createLeague(params: {
  leagueId: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerNickname?: string;
  inviteCode: string;
}) {
  const db = getFirebaseDb();

  await setDoc(doc(db, "leagues", params.leagueId), {
    name: params.name,
    ownerId: params.ownerId,
    inviteCode: params.inviteCode,
    status: "active",
    memberCount: 1,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "leagues", params.leagueId, "members", params.ownerId), {
    userId: params.ownerId,
    nickname: params.ownerNickname ?? params.ownerDisplayName,
    displayName: params.ownerDisplayName,
    photoURL: "",
    role: "owner",
    totalPoints: 0,
    exactHits: 0,
    rank: 1,
    joinedAt: serverTimestamp(),
  });
}

export async function getUserLeagues(userId: string) {
  const db = getFirebaseDb();
  try {
    const membershipSnapshot = await getDocs(
      query(collectionGroup(db, "members"), where("userId", "==", userId)),
    );

    const leagues = await Promise.all(
      membershipSnapshot.docs.map(async (membershipDoc) => {
        const leagueRef = membershipDoc.ref.parent.parent;

        if (!leagueRef) {
          return null;
        }

        const leagueDoc = await getDoc(leagueRef);
        if (!leagueDoc.exists()) {
          return null;
        }

        return {
          id: leagueDoc.id,
          ...(leagueDoc.data() as League),
        };
      }),
    );

    return leagues.filter(Boolean) as Array<League & { id: string }>;
  } catch {
    const leaguesSnapshot = await getDocs(collection(db, "leagues"));
    const memberships = await Promise.all(
      leaguesSnapshot.docs.map(async (leagueDoc) => {
        const memberDoc = await getDoc(
          doc(db, "leagues", leagueDoc.id, "members", userId),
        );

        if (!memberDoc.exists()) {
          return null;
        }

        return {
          id: leagueDoc.id,
          ...(leagueDoc.data() as League),
        };
      }),
    );

    return memberships.filter(Boolean) as Array<League & { id: string }>;
  }
}

function buildInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createLeagueForUser(params: {
  ownerId: string;
  ownerProfile: AppUser;
  leagueName: string;
}) {
  const db = getFirebaseDb();
  const leagueId = `league_${Date.now()}`;
  const inviteCode = buildInviteCode();
  const ownerName =
    params.ownerProfile.firstName ||
    params.ownerProfile.displayName ||
    params.ownerProfile.nickname ||
    "Oyuncu";
  const ownerNickname =
    params.ownerProfile.nickname || params.ownerProfile.displayName || "oyuncu";

  await createLeague({
    leagueId,
    name: params.leagueName.trim(),
    ownerId: params.ownerId,
    ownerDisplayName: ownerName,
    ownerNickname,
    inviteCode,
  });

  await updateDoc(doc(db, "users", params.ownerId), {
    activeLeagueId: leagueId,
  });

  return { leagueId, inviteCode };
}

export async function joinLeagueWithInviteCode(params: {
  userId: string;
  userProfile: AppUser;
  inviteCode: string;
}) {
  const db = getFirebaseDb();
  const normalizedCode = params.inviteCode.trim().toUpperCase();
  const leagueSnapshot = await getDocs(
    query(
      collection(db, "leagues"),
      where("inviteCode", "==", normalizedCode),
      limit(1),
    ),
  );

  if (leagueSnapshot.empty) {
    throw new Error("Bu davet koduyla bir lig bulunamadı.");
  }

  const leagueDoc = leagueSnapshot.docs[0];
  const leagueId = leagueDoc.id;
  const memberRef = doc(db, "leagues", leagueId, "members", params.userId);
  const userRef = doc(db, "users", params.userId);
  const existingMember = await getDoc(memberRef);

  const batch = writeBatch(db);
  batch.update(userRef, { activeLeagueId: leagueId });

  if (!existingMember.exists()) {
    batch.set(memberRef, {
      userId: params.userId,
      nickname:
        params.userProfile.nickname ||
        params.userProfile.displayName ||
        "oyuncu",
      displayName:
        params.userProfile.firstName ||
        params.userProfile.displayName ||
        params.userProfile.nickname ||
        "Oyuncu",
      photoURL: params.userProfile.photoURL || "",
      role: "member",
      totalPoints: 0,
      exactHits: 0,
      rank: 99,
      joinedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  if (!existingMember.exists()) {
    await updateDoc(doc(db, "leagues", leagueId), {
      memberCount: increment(1),
    });
  }

  return {
    leagueId,
    leagueName: (leagueDoc.data() as League).name,
  };
}

export async function setActiveLeague(userId: string, leagueId: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", userId), {
    activeLeagueId: leagueId,
  });
}

export async function leaveLeague(params: {
  userId: string;
  leagueId: string;
}) {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", params.userId);
  const leagueRef = doc(db, "leagues", params.leagueId);
  const memberRef = doc(db, "leagues", params.leagueId, "members", params.userId);

  const [leagueSnapshot, memberSnapshot, joinedLeagues] = await Promise.all([
    getDoc(leagueRef),
    getDoc(memberRef),
    getUserLeagues(params.userId),
  ]);

  if (!leagueSnapshot.exists() || !memberSnapshot.exists()) {
    throw new Error("Bu lige ait üye kaydı bulunamadı.");
  }

  const league = leagueSnapshot.data() as League;
  const member = memberSnapshot.data() as LeagueMember;
  const nextActiveLeagueId =
    joinedLeagues.find((item) => item.id !== params.leagueId)?.id || "";

  if (member.role === "owner" && league.memberCount > 1) {
    throw new Error(
      "Bu ligin sahibisin. Ayrılmak için önce diğer üyelerin ayrılması gerekiyor.",
    );
  }

  const batch = writeBatch(db);

  if (member.role === "owner" && league.memberCount <= 1) {
    batch.delete(memberRef);
    batch.delete(leagueRef);
    batch.update(userRef, { activeLeagueId: nextActiveLeagueId });
    await batch.commit();
    return { removedLeague: true, nextActiveLeagueId };
  }

  batch.delete(memberRef);
  batch.update(leagueRef, {
    memberCount: increment(-1),
  });
  batch.update(userRef, {
    activeLeagueId: nextActiveLeagueId,
  });
  await batch.commit();

  return { removedLeague: false, nextActiveLeagueId };
}
