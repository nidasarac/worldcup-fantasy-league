export type AppUser = {
  firstName?: string;
  nickname?: string;
  displayName: string;
  email: string;
  photoURL: string;
  activeLeagueId: string;
};

export type League = {
  name: string;
  ownerId: string;
  inviteCode: string;
  status: "active" | "archived";
  memberCount: number;
};

export type LeagueMember = {
  userId: string;
  nickname?: string;
  displayName: string;
  photoURL: string;
  role: "owner" | "member";
  totalPoints: number;
  exactHits: number;
  rank: number;
};

export type FirebaseMatch = {
  externalMatchId: string;
  stage: string;
  group: string;
  matchday: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  stadiumId: string;
  stadiumName: string;
  kickoffAt: string;
  opensAt: string;
  locksAt: string;
  status: "upcoming" | "open" | "locked" | "finished";
};

export type PredictionQuestion = {
  type: string;
  label: string;
  options: string[];
  sortOrder: number;
  required: boolean;
  status: "active" | "inactive";
  scoring: {
    mode: "exact" | "partial";
    points: number;
  };
};

export type MatchResult = {
  homeScore: number;
  awayScore: number;
  winner: string;
  bothTeamsScore: boolean;
  redCard: boolean;
  resolvedAt: string;
  firstHalfGoals?: number;
  halfTimeHomeGoals?: number;
  halfTimeAwayGoals?: number;
  firstGoalTeam?: string;
  // API-Football stats
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  homeCorners?: number;
  awayCorners?: number;
};

export type Prediction = {
  userId: string;
  leagueId: string;
  matchId: string;
  submittedAt: string;
  status: "draft" | "submitted" | "settled";
  totalPointsAwarded: number;
  isExactHit?: boolean;
  settledAt?: string;
};

export type PredictionAnswer = {
  questionId: string;
  type: string;
  selectedValue: string;
  awardedPoints: number;
  resultStatus: "pending" | "correct" | "wrong";
};
