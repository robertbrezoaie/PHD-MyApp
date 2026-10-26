// Row types used by the app. The Database type is generated from the live schema
// into database.generated.ts with `npm run gen:types`; do not edit that file by hand.
import type { Database } from "./database.generated";

export type { Database };

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type Quest = Tables["quests"]["Row"];
export type UserQuest = Tables["user_quests"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type UserTask = Tables["user_tasks"]["Row"];
export type Question = Tables["questions"]["Row"];
export type Badge = Tables["badges"]["Row"];
export type UserBadge = Tables["user_badges"]["Row"];
export type LeaderboardEntry = Database["public"]["Views"]["leaderboard"]["Row"];
