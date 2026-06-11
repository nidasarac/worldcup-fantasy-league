import { Platform } from "react-native";
import { DateTime } from "luxon";

import { getDisplayTeam, getTurkeyDateTime, WorldCupData } from "../api/worldCup";

// expo-notifications sadece native build'de (dev-client / production) çalışır.
// Expo Go'da native modül yoktur — tüm çağrılar try-catch ile korunuyor.

function getNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

function initHandler() {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // native modül yüklenemedi, Expo Go'da beklenen durum
  }
}

// Uygulama başlangıcında bir kez çağır
initHandler();

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const N = getNotifications();
  if (!N) return false;

  try {
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await N.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function scheduleMatchNotifications(
  data: WorldCupData,
): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const now = DateTime.now().setZone("Europe/Istanbul");

  const upcoming = data.games.filter((game) => {
    if (game.finished === "TRUE") return false;
    const kickoff = getTurkeyDateTime(game);
    if (!kickoff) return false;
    const minutesUntil = kickoff.diff(now, "minutes").minutes;
    return minutesUntil > 62 && minutesUntil < 60 * 24 * 8;
  });

  await cancelMatchNotifications();

  for (const game of upcoming) {
    const kickoff = getTurkeyDateTime(game);
    if (!kickoff) continue;

    const notifyAt = kickoff.minus({ minutes: 60 });
    if (notifyAt.toMillis() <= now.toMillis()) continue;

    const home = getDisplayTeam(game, "home", data.teamMap);
    const away = getDisplayTeam(game, "away", data.teamMap);

    try {
      await N.scheduleNotificationAsync({
        identifier: `match-${game.id}`,
        content: {
          title: "Tahmin pencereniz kapanıyor!",
          body: `${home.name} – ${away.name} maçına 1 saat kaldı. Hemen tahmin yap!`,
          data: { matchId: game.id },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: notifyAt.toJSDate(),
        },
      });
    } catch {
      // tek bir maç schedule edilemezse diğerlerine devam et
    }
  }
}

export async function cancelMatchNotifications(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    const matchNotifs = scheduled.filter((n) =>
      n.identifier.startsWith("match-"),
    );
    await Promise.all(
      matchNotifs.map((n) =>
        N.cancelScheduledNotificationAsync(n.identifier),
      ),
    );
  } catch {
    // sessizce geç
  }
}
