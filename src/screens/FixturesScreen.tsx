import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import {
  formatTurkeyMonthLabel,
  formatTurkeyDateLong,
  formatTurkeyMatchTime,
  getDisplayTeam,
  getGameStatus,
  getStageLabel,
  getTurkeyDateKey,
  getTurkeyDateTime,
  WorldCupData,
} from "../api/worldCup";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

export function FixturesScreen({
  styles,
  theme,
  data,
  loading,
  error,
}: {
  styles: AppStyles;
  theme: ThemePalette;
  data: WorldCupData | null;
  loading: boolean;
  error: string | null;
}) {
  const KNOCKOUT_ORDER = ["r32", "r16", "qf", "sf", "third", "final"] as const;
  const KNOCKOUT_LABELS: Record<string, string> = {
    r32: "Son 32",
    r16: "Son 16",
    qf: "Çeyrek Final",
    sf: "Yarı Final",
    third: "Üçüncülük",
    final: "Final",
  };

  const allFixtures = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.games]
      .filter((game) => game.source !== "manual-test")
      .sort((left, right) => {
        const leftTime = getTurkeyDateTime(left)?.toMillis() ?? 0;
        const rightTime = getTurkeyDateTime(right)?.toMillis() ?? 0;
        return leftTime - rightTime;
      });
  }, [data]);

  const dateOptions = useMemo(
    () =>
      [...new Set(allFixtures.map((fixture) => getTurkeyDateKey(fixture)))].filter(
        Boolean,
      ),
    [allFixtures],
  );

  const groupOptions = useMemo(() => {
    const apiGroupLetters = data?.groups.map((g) => g.name) ?? [];
    const gameGroupLetters = allFixtures
      .filter((g) => g.type === "group")
      .map((g) => g.group)
      .filter(Boolean);
    const groupLetters = Array.from(new Set([...apiGroupLetters, ...gameGroupLetters])).sort((a, b) =>
      a.localeCompare(b),
    );

    const gameTypes = new Set(allFixtures.map((g) => g.type));
    const knockoutOptions = KNOCKOUT_ORDER.filter((k) => gameTypes.has(k));

    return ["ALL", ...groupLetters, ...knockoutOptions];
  }, [data, allFixtures]);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      const todayKey = DateTime.now().setZone("Europe/Istanbul").toFormat("yyyy-MM-dd");
      const defaultDate = dateOptions.includes(todayKey)
        ? todayKey
        : (dateOptions.find((d) => d >= todayKey) ?? dateOptions[0]);
      setSelectedDate(defaultDate);
    }
  }, [dateOptions, selectedDate]);

  useEffect(() => {
    if (!selectedMonth && dateOptions.length > 0) {
      const todayKey = DateTime.now().setZone("Europe/Istanbul").toFormat("yyyy-MM-dd");
      const defaultDate = dateOptions.includes(todayKey)
        ? todayKey
        : (dateOptions.find((d) => d >= todayKey) ?? dateOptions[0]);
      setSelectedMonth(defaultDate.slice(0, 7));
    }
  }, [dateOptions, selectedMonth]);

  const monthOptions = useMemo(
    () => [...new Set(dateOptions.map((dateKey) => dateKey.slice(0, 7)))],
    [dateOptions],
  );

  const calendarDays = useMemo(() => {
    if (!selectedMonth) {
      return [];
    }

    const monthStart = DateTime.fromISO(`${selectedMonth}-01`, {
      zone: "Europe/Istanbul",
      locale: "tr",
    });

    if (!monthStart.isValid) {
      return [];
    }

    const firstCell = monthStart.startOf("week");
    const lastCell = monthStart.endOf("month").endOf("week");
    const days = [];
    let cursor = firstCell;

    while (cursor <= lastCell) {
      const dateKey = cursor.toFormat("yyyy-MM-dd");
      days.push({
        dateKey,
        dayLabel: cursor.toFormat("d"),
        inCurrentMonth: cursor.month === monthStart.month,
        hasMatch: dateOptions.includes(dateKey),
      });
      cursor = cursor.plus({ days: 1 });
    }

    return days;
  }, [dateOptions, selectedMonth]);

  const monthLabel = useMemo(() => {
    if (!selectedMonth) {
      return "";
    }

    return formatTurkeyMonthLabel(selectedMonth);
  }, [selectedMonth]);

  const fixtures = useMemo(
    () =>
      allFixtures.filter((fixture) => {
        const sameDate = !selectedDate || getTurkeyDateKey(fixture) === selectedDate;
        const sameGroup =
          selectedGroup === "ALL" ||
          (selectedGroup in KNOCKOUT_LABELS
            ? fixture.type === selectedGroup
            : fixture.group === selectedGroup);

        return sameDate && sameGroup;
      }),
    [allFixtures, selectedDate, selectedGroup],
  );

  const selectedGroupTable =
    selectedGroup !== "ALL"
      ? data?.groups.find((group) => group.name === selectedGroup)
      : null;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionCopy}>
          Saatler Türkiye saatine göre gösterilir. Gün seç, grup filtrele ve
          maçları hızlı takip et.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Fikstür yükleniyor</Text>
          <Text style={styles.loadingCopy}>
            Tüm turnuva maçları canlı servisten alınıyor.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Fikstür alınamadı</Text>
          <Text style={styles.loadingCopy}>{error}</Text>
        </View>
      ) : null}

      {dateOptions.length ? (
        <View style={styles.groupCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.groupTitle}>Takvim</Text>
            <View style={styles.calendarMonthRow}>
              <Pressable
                onPress={() => {
                  const currentIndex = monthOptions.indexOf(selectedMonth);
                  if (currentIndex > 0) {
                    setSelectedMonth(monthOptions[currentIndex - 1]);
                  }
                }}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color={theme.ink}
                />
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => {
                  const currentIndex = monthOptions.indexOf(selectedMonth);
                  if (currentIndex >= 0 && currentIndex < monthOptions.length - 1) {
                    setSelectedMonth(monthOptions[currentIndex + 1]);
                  }
                }}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={theme.ink}
                />
              </Pressable>
            </View>
          </View>
          <View style={styles.calendarWeekHeader}>
            {["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"].map((label) => (
              <Text key={label} style={styles.calendarWeekLabel}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => {
              const active = day.dateKey === selectedDate;

              return (
                <Pressable
                  key={day.dateKey}
                  onPress={() => day.hasMatch && setSelectedDate(day.dateKey)}
                  style={[
                    styles.calendarDay,
                    !day.inCurrentMonth && styles.calendarDayMuted,
                    day.hasMatch && styles.calendarDayHasMatch,
                    active && styles.calendarDayActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      !day.inCurrentMonth && styles.calendarDayTextMuted,
                      active && styles.calendarDayTextActive,
                    ]}
                  >
                    {day.dayLabel}
                  </Text>
                  {day.hasMatch ? <View style={styles.calendarDot} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.loadingCopy}>
            Seçili gün: {selectedDate ? formatTurkeyDateLong(selectedDate) : "-"}
          </Text>
        </View>
      ) : null}

      {groupOptions.length ? (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Grup Filtresi</Text>
          <View style={styles.filterWrap}>
            {groupOptions.map((groupName) => {
              const active = groupName === selectedGroup;

              return (
                <Pressable
                  key={groupName}
                  onPress={() => setSelectedGroup(groupName)}
                  style={[
                    styles.optionPill,
                    active && styles.optionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      active && styles.optionPillTextActive,
                    ]}
                  >
                    {groupName === "ALL"
                      ? "Tüm Maçlar"
                      : KNOCKOUT_LABELS[groupName] ?? `Grup ${groupName}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {fixtures.map((fixture) => {
        const homeTeam = getDisplayTeam(fixture, "home", data?.teamMap ?? {});
        const awayTeam = getDisplayTeam(fixture, "away", data?.teamMap ?? {});
        const stadium = data?.stadiumMap[fixture.stadium_id];

        return (
          <View key={fixture._id} style={styles.fixtureCard}>
            <View style={styles.fixtureTopRow}>
              <View>
                <Text style={styles.fixtureDay}>{getStageLabel(fixture)}</Text>
                <Text style={styles.fixtureTime}>
                  {formatTurkeyMatchTime(fixture)}
                </Text>
              </View>
              <Text style={styles.fixtureStatus}>{getGameStatus(fixture)}</Text>
            </View>

            <View style={styles.fixtureTeamsRow}>
              {homeTeam.flag ? (
                <Image
                  source={{ uri: homeTeam.flag }}
                  style={styles.fixtureFlagImage}
                />
              ) : (
                <Text style={styles.fixtureFlag}>🏳️</Text>
              )}
              <Text style={styles.fixtureTeamName}>{homeTeam.name}</Text>
            </View>

            <View style={styles.fixtureTeamsRow}>
              {awayTeam.flag ? (
                <Image
                  source={{ uri: awayTeam.flag }}
                  style={styles.fixtureFlagImage}
                />
              ) : (
                <Text style={styles.fixtureFlag}>🏳️</Text>
              )}
              <Text style={styles.fixtureTeamName}>{awayTeam.name}</Text>
            </View>

            <View style={styles.fixtureBottomRow}>
              <Text style={styles.fixtureMeta}>
                {stadium?.fifa_name ?? "TBD"} • {stadium?.city_en ?? "TBD"}
              </Text>
              <Text style={styles.fixtureQuestions}>
                Skor {fixture.home_score}-{fixture.away_score}
              </Text>
            </View>
          </View>
        );
      })}

      {!loading && !error && !fixtures.length ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Maç bulunamadı</Text>
          <Text style={styles.loadingCopy}>
            Bu tarih ve grup kombinasyonunda maç yok.
          </Text>
        </View>
      ) : null}

      {selectedGroupTable ? (
        <View style={styles.groupCard}>
          <View style={styles.groupTitleRow}>
            <Text style={styles.groupTitle}>Grup {selectedGroupTable.name}</Text>
            <Text style={styles.groupSubtitle}>Puan Durumu</Text>
          </View>

          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderTeam}>Takim</Text>
            <Text style={styles.tableHeaderCell}>O</Text>
            <Text style={styles.tableHeaderCell}>G</Text>
            <Text style={styles.tableHeaderCell}>B</Text>
            <Text style={styles.tableHeaderCell}>M</Text>
            <Text style={styles.tableHeaderCell}>P</Text>
          </View>

          {[...selectedGroupTable.teams]
            .sort((left, right) => Number(right.pts) - Number(left.pts))
            .map((row, index) => {
              const team = data?.teamMap[row.team_id];

              return (
                <View key={row._id} style={styles.groupRow}>
                  <Text style={styles.groupRank}>{index + 1}</Text>
                  <View style={styles.groupTeamWrap}>
                    {team?.flag ? (
                      <Image
                        source={{ uri: team.flag }}
                        style={styles.groupTeamFlag}
                      />
                    ) : null}
                    <Text style={styles.groupTeamName}>
                      {team?.name_en ?? `Team ${row.team_id}`}
                    </Text>
                  </View>
                  <Text style={styles.groupCell}>{row.mp}</Text>
                  <Text style={styles.groupCell}>{row.w}</Text>
                  <Text style={styles.groupCell}>{row.d}</Text>
                  <Text style={styles.groupCell}>{row.l}</Text>
                  <Text style={styles.groupCell}>{row.pts}</Text>
                </View>
              );
            })}
        </View>
      ) : null}
    </>
  );
}
