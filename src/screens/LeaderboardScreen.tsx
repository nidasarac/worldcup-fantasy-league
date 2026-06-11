import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { WorldCupData } from "../api/worldCup";
import { AppModal } from "../components/AppModal";
import { AppStyles } from "../styles";
import { League, LeagueMember } from "../types/firestore";
import { ThemePalette } from "../theme";

export function LeaderboardScreen({
  styles,
  theme,
  data,
  loading,
  error,
  leagueMembers,
  league,
  currentUserId,
  onLeaveLeague,
  activeLeagueId,
}: {
  styles: AppStyles;
  theme: ThemePalette;
  data: WorldCupData | null;
  loading: boolean;
  error: string | null;
  leagueMembers: Array<LeagueMember & { id: string }>;
  league: League | null;
  currentUserId: string;
  onLeaveLeague: (leagueId: string) => Promise<void>;
  activeLeagueId?: string;
}) {
  const hasMembers = leagueMembers.length > 0;
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const topThree = leagueMembers.slice(0, 3);
  const remainingMembers = leagueMembers.slice(3);
  const currentUserMember = leagueMembers.find(
    (member) => member.userId === currentUserId,
  );

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopyInviteCode = async () => {
    if (!league?.inviteCode) {
      return;
    }

    await Clipboard.setStringAsync(league.inviteCode);
    setCopied(true);
  };

  const handleConfirmLeaveLeague = async () => {
    try {
      setLeaving(true);
      if (!activeLeagueId) {
        throw new Error("Aktif lig bilgisi bulunamadı.");
      }
      await onLeaveLeague(activeLeagueId);
      setShowLeaveModal(false);
    } finally {
      setLeaving(false);
    }
  };

  const podiumEntries = [
    topThree[1]
      ? { member: topThree[1], place: 2 as const, medal: "silver" as const }
      : { member: null, place: 2 as const, medal: "silver" as const },
    topThree[0]
      ? { member: topThree[0], place: 1 as const, medal: "gold" as const }
      : { member: null, place: 1 as const, medal: "gold" as const },
    topThree[2]
      ? { member: topThree[2], place: 3 as const, medal: "bronze" as const }
      : { member: null, place: 3 as const, medal: "bronze" as const },
  ];

  const listEntries =
    remainingMembers.length > 0
      ? remainingMembers.map((member, index) => ({
          member,
          rank: topThree.length + index + 1,
        }))
      : [
          { member: null, rank: Math.max(topThree.length + 1, 4) },
          { member: null, rank: Math.max(topThree.length + 2, 5) },
        ];

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionCopy}>
          Bu alanda aktif ligindeki puan yarışı ve sıralama yer alır.
        </Text>
      </View>

      <View style={styles.groupCard}>
        <View style={styles.groupTitleRow}>
          <View style={styles.groupTitleWrap}>
            <Text style={styles.groupTitle}>{league?.name || "Aktif lig"}</Text>
            <Text style={styles.groupSubtitle}>
              {league?.inviteCode
                ? "Arkadaşlarını bu kodla lige davet et."
                : "Aktif bir lig seçildiğinde davet kodun burada görünür."}
            </Text>
          </View>

          {league?.inviteCode ? (
            <Pressable
              onPress={handleCopyInviteCode}
              style={styles.copyIconButton}
            >
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#03162d"
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.leagueActionsRow}>
          {league?.inviteCode ? (
            <Pressable
              onPress={handleCopyInviteCode}
              style={styles.inviteCodeChip}
            >
              <Text style={styles.inviteCodeLabel}>Davet kodu</Text>
              <Text style={styles.inviteCodeValue}>{league.inviteCode}</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {league && currentUserMember ? (
            <Pressable
              onPress={() => setShowLeaveModal(true)}
              disabled={leaving}
              style={styles.leaveLeagueButton}
            >
              {leaving ? (
                <ActivityIndicator color={theme.heroText} />
              ) : (
                <Text style={styles.leaveLeagueButtonText}>Ligden ayrıl</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {copied ? (
          <View style={styles.copyToast}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color={theme.success}
            />
            <Text style={styles.copyToastText}>Kod panoya kopyalandı.</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.groupCard}>
          <Text style={styles.loadingTitle}>Lig üyeleri yükleniyor</Text>
          <Text style={styles.loadingCopy}>Kadro ve puanlar hazırlanıyor.</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.groupCard}>
          <Text style={styles.loadingTitle}>Lig verisi alınamadı</Text>
          <Text style={styles.loadingCopy}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={styles.podiumWrap}>
          {podiumEntries.map((entry) => {
            const nickname = entry.member
              ? entry.member.nickname || entry.member.displayName || "oyuncu"
              : null;
            const isGold = entry.medal === "gold";
            const isPlaceholder = !entry.member;
            const medalStyles =
              entry.medal === "gold"
                ? [styles.podiumCard, styles.podiumCardGold]
                : entry.medal === "silver"
                  ? [styles.podiumCard, styles.podiumCardSilver]
                  : [styles.podiumCard, styles.podiumCardBronze];
            const rankStyles =
              entry.medal === "gold"
                ? [styles.podiumRankBadge, styles.podiumRankBadgeGold]
                : entry.medal === "silver"
                  ? [styles.podiumRankBadge, styles.podiumRankBadgeSilver]
                  : [styles.podiumRankBadge, styles.podiumRankBadgeBronze];

            return (
              <View
                key={entry.place}
                style={[
                  styles.podiumColumn,
                  isGold
                    ? styles.podiumColumnGold
                    : entry.medal === "silver"
                      ? styles.podiumColumnSilver
                      : styles.podiumColumnBronze,
                ]}
              >
                <View
                  style={[
                    ...medalStyles,
                    isPlaceholder && styles.podiumCardPlaceholder,
                  ]}
                >
                  <View style={rankStyles}>
                    <Text style={styles.podiumRankText}>{entry.place}</Text>
                  </View>
                  {entry.member ? (
                    <>
                      <Text style={styles.podiumName}>@{nickname}</Text>
                      <Text style={styles.podiumPoints}>
                        {entry.member.totalPoints}
                      </Text>
                      <Text style={styles.podiumMeta}>
                        {entry.place}. sira • {entry.member.exactHits} tam isabet
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.podiumSkeletonName} />
                      <View style={styles.podiumSkeletonScore} />
                      <View style={styles.podiumSkeletonMeta} />
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {!loading && !error
        ? listEntries.map((entry, index) => {
            const nickname = entry.member
              ? entry.member.nickname || entry.member.displayName || "oyuncu"
              : null;
            const badge =
              entry.member && index === 0 ? "Takipte" : entry.member ? "Yükseliyor" : "Boş";

            return (
              <View
                key={entry.member?.id ?? `placeholder-${entry.rank}`}
                style={[
                  styles.leaderRow,
                  !entry.member && styles.leaderRowPlaceholder,
                ]}
              >
                <Text
                  style={[
                    styles.leaderNumber,
                    !entry.member && styles.placeholderText,
                  ]}
                >
                  {entry.member ? entry.member.rank || entry.rank : entry.rank}
                </Text>
                <View style={styles.leaderBody}>
                  {entry.member ? (
                    <>
                      <Text style={styles.leaderName}>@{nickname}</Text>
                      <Text style={styles.leaderMeta}>
                        {entry.member.exactHits} tam isabet •{" "}
                        {entry.member.role === "owner" ? "Lig sahibi" : "Üye"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.leaderSkeletonName} />
                      <View style={styles.leaderSkeletonMeta} />
                    </>
                  )}
                </View>
                <View style={styles.leaderPointsWrap}>
                  {entry.member ? (
                    <>
                      <Text style={styles.leaderPoints}>
                        {entry.member.totalPoints}
                      </Text>
                      <Text style={styles.leaderBadge}>{badge}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.leaderSkeletonScore} />
                      <View style={styles.leaderSkeletonBadge} />
                    </>
                  )}
                </View>
              </View>
            );
          })
        : null}

      <AppModal
        visible={showLeaveModal}
        title="Ligden ayrıl"
        body="Bu ligden ayrıldığında aktif ligin değişebilir. Eminsen devam et."
        confirmLabel="Ayrıl"
        danger
        loading={leaving}
        onConfirm={handleConfirmLeaveLeague}
        onClose={() => !leaving && setShowLeaveModal(false)}
        styles={styles}
        theme={theme}
      />
    </>
  );
}
