export type TabKey = "home" | "fixtures" | "leaderboard" | "profile";
export type ThemeMode = "dark" | "light";

export type TabItem = {
  key: TabKey;
  label: string;
  icon: string;
};

export type ThemePalette = {
  bg: string;
  bgSecondary: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  cardStrong: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  success: string;
  danger: string;
  hero: string;
  heroSecondary: string;
  heroText: string;
  heroMuted: string;
  navGradient: [string, string, string];
  navGlow: string;
  navActiveGradient: [string, string, string];
  navIdleIcon: string;
  navIdleText: string;
  navActiveText: string;
  ornamentTop: string;
  ornamentBottom: string;
  cardWarm: string;
  chipBg: string;
  overlay: string;
};

export const tabs: TabItem[] = [
  { key: "home", label: "Ana Sayfa", icon: "soccer" },
  { key: "fixtures", label: "Maclar", icon: "calendar-month" },
  { key: "leaderboard", label: "Lig", icon: "podium-gold" },
  { key: "profile", label: "Profil", icon: "account-circle" },
];

export const themes: Record<ThemeMode, ThemePalette> = {
  dark: {
    bg: "#06152d",
    bgSecondary: "#091f42",
    surface: "#0c2448",
    surfaceAlt: "#12315f",
    card: "#0e2951",
    cardStrong: "#102f5d",
    ink: "#f6fbff",
    muted: "#8eabd0",
    line: "rgba(154, 192, 255, 0.18)",
    accent: "#38b6ff",
    accentStrong: "#0d8cf6",
    accentSoft: "rgba(56, 182, 255, 0.14)",
    success: "#3ddc97",
    danger: "#ff6b7a",
    hero: "#0a2d5c",
    heroSecondary: "#0e3d79",
    heroText: "#ffffff",
    heroMuted: "#c8dbf7",
    navGradient: ["rgba(6,21,45,0.98)", "rgba(10,45,92,0.96)", "rgba(13,140,246,0.92)"],
    navGlow: "rgba(70, 181, 255, 0.18)",
    navActiveGradient: ["#ebf7ff", "#9edfff", "#46b9ff"],
    navIdleIcon: "rgba(232, 244, 255, 0.74)",
    navIdleText: "rgba(232, 244, 255, 0.84)",
    navActiveText: "#08203f",
    ornamentTop: "#0f4a8a",
    ornamentBottom: "#0a63ad",
    cardWarm: "rgba(255, 196, 72, 0.12)",
    chipBg: "rgba(255, 255, 255, 0.08)",
    overlay: "rgba(4, 15, 30, 0.66)",
  },
  light: {
    bg: "#eef6ff",
    bgSecondary: "#ddeaff",
    surface: "#ffffff",
    surfaceAlt: "#edf5ff",
    card: "#f7fbff",
    cardStrong: "#edf5ff",
    ink: "#10233f",
    muted: "#5d7395",
    line: "rgba(38, 89, 154, 0.12)",
    accent: "#1e88ff",
    accentStrong: "#0062d6",
    accentSoft: "rgba(30, 136, 255, 0.12)",
    success: "#14b86f",
    danger: "#e25569",
    hero: "#0a2d5c",
    heroSecondary: "#16467f",
    heroText: "#ffffff",
    heroMuted: "#d8e8ff",
    navGradient: ["rgba(10,45,92,0.96)", "rgba(22,70,127,0.96)", "rgba(30,136,255,0.92)"],
    navGlow: "rgba(30, 136, 255, 0.16)",
    navActiveGradient: ["#ffffff", "#d6ecff", "#9dd8ff"],
    navIdleIcon: "rgba(255,255,255,0.76)",
    navIdleText: "rgba(255,255,255,0.88)",
    navActiveText: "#08203f",
    ornamentTop: "#cce4ff",
    ornamentBottom: "#b8d7ff",
    cardWarm: "rgba(255, 196, 72, 0.12)",
    chipBg: "rgba(16, 35, 63, 0.06)",
    overlay: "rgba(8, 22, 43, 0.5)",
  },
};
