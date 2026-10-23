import { supabase } from "./supabase";
import type { Profile, Quest, Task, UserTask, LeaderboardEntry, Badge, UserBadge } from "./database.types";

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

// ─── Daily Tasks ─────────────────────────────────────────────────────────────

export type TaskWithCompletion = Task & { completed: boolean; user_task_id: string | null };

export async function getTodaysTasks(userId: string): Promise<TaskWithCompletion[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_daily", true);

  const { data: userTasks } = await supabase
    .from("user_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("task_date", today);

  return (tasks ?? []).map((task) => {
    const userTask = (userTasks ?? []).find((ut) => ut.task_id === task.id);
    return {
      ...task,
      completed: userTask?.completed ?? false,
      user_task_id: userTask?.id ?? null,
    };
  });
}

export async function toggleTask(
  userId: string,
  taskId: string,
  userTaskId: string | null,
  completed: boolean
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  if (userTaskId) {
    await supabase
      .from("user_tasks")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", userTaskId);
  } else {
    await supabase.from("user_tasks").insert({
      user_id: userId,
      task_id: taskId,
      completed,
      task_date: today,
      completed_at: completed ? new Date().toISOString() : null,
    });
  }
}

export async function getInitialTasks(userId: string): Promise<TaskWithCompletion[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data: allTasks } = await supabase.from("tasks").select("*").eq("is_daily", true);
  const { data: completed } = await supabase
    .from("user_tasks").select("task_id")
    .eq("user_id", userId).eq("task_date", today).eq("completed", true);
  const completedIds = new Set((completed ?? []).map((ut: any) => ut.task_id));
  const available = (allTasks ?? []).filter((t: any) => !completedIds.has(t.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 4);
  return shuffled.map((t: any) => ({ ...t, completed: false, user_task_id: null }));
}

export async function getNextTask(userId: string, excludeIds: string[]): Promise<TaskWithCompletion | null> {
  const today = new Date().toISOString().split("T")[0];
  const { data: allTasks } = await supabase.from("tasks").select("*").eq("is_daily", true);
  const { data: completed } = await supabase
    .from("user_tasks").select("task_id")
    .eq("user_id", userId).eq("task_date", today).eq("completed", true);
  const excludeSet = new Set([...excludeIds, ...(completed ?? []).map((ut: any) => ut.task_id)]);
  const available = (allTasks ?? []).filter((t: any) => !excludeSet.has(t.id));
  if (available.length === 0) return null;
  return { ...available[Math.floor(Math.random() * available.length)], completed: false, user_task_id: null };
}

export const energyCostFor = (xpReward: number): number =>
  Math.max(2, Math.round(xpReward / 5));

export async function completeTask(userId: string, taskId: string, xpReward: number): Promise<void> {
  const energyCost = energyCostFor(xpReward);
  const today = new Date().toISOString().split("T")[0];

  await supabase.from("user_tasks").insert({
    user_id: userId, task_id: taskId,
    completed: true, task_date: today,
    completed_at: new Date().toISOString(),
  });

  const { data: p } = await supabase.from("profiles").select("xp, points, coins, energy, streak_days").eq("id", userId).single();
  if (p) {
    const newXp = (p.xp ?? 0) + xpReward;
    const streakBonus = Math.min(p.streak_days ?? 0, 10);
    const coinsEarned = Math.floor(xpReward / 3) + streakBonus;
    await supabase.from("profiles").update({
      xp: newXp,
      level: Math.floor(newXp / 1000) + 1,
      points: (p.points ?? 0) + xpReward,
      coins: (p.coins ?? 0) + coinsEarned,
      energy: Math.max(0, (p.energy ?? 0) - energyCost),
    }).eq("id", userId);
  }
}

// ─── Quests ──────────────────────────────────────────────────────────────────

export type QuestWithProgress = Quest & {
  xp_progress: number;
  completed: boolean;
  user_quest_id: string | null;
};

export async function getQuestsWithProgress(userId: string): Promise<QuestWithProgress[]> {
  const { data: quests } = await supabase.from("quests").select("*");

  const { data: userQuests } = await supabase
    .from("user_quests")
    .select("*")
    .eq("user_id", userId);

  return (quests ?? []).map((quest) => {
    const uq = (userQuests ?? []).find((u) => u.quest_id === quest.id);
    return {
      ...quest,
      xp_progress: uq?.xp_progress ?? 0,
      completed: uq?.completed ?? false,
      user_quest_id: uq?.id ?? null,
    };
  });
}

export async function getFirstQuestionForQuest(questId: string) {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("quest_id", questId)
    .order("order_num", { ascending: true })
    .limit(1)
    .single();
  return data;
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export type BadgeWithEarned = Badge & { earned: boolean; earned_at: string | null };

export async function getBadgesWithEarned(userId: string): Promise<BadgeWithEarned[]> {
  const { data: badges } = await supabase.from("badges").select("*");

  const { data: userBadges } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId);

  return (badges ?? []).map((badge) => {
    const ub = (userBadges ?? []).find((u: UserBadge) => u.badge_id === badge.id);
    return {
      ...badge,
      earned: !!ub,
      earned_at: ub?.earned_at ?? null,
    };
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .limit(10);
  return data ?? [];
}

// ─── Submit Answer (via Edge Function) ───────────────────────────────────────

export type SubmitAnswerResult = {
  success: boolean;
  xp_gained: number;
  coins_gained: number;
  streak_days: number;
  level_up: boolean;
  new_level: number;
  new_badges: string[];
};

export async function submitAnswer(
  questionId: string,
  answerText: string,
  questId: string
): Promise<SubmitAnswerResult> {
  const { data, error } = await supabase.functions.invoke("submit-answer", {
    body: { question_id: questionId, answer_text: answerText, quest_id: questId },
  });
  if (error) throw error;
  return data as SubmitAnswerResult;
}

// ─── Avatar Frames ────────────────────────────────────────────────────────────

export type FrameId = "space" | "cyber" | "fire" | "gold";

export const AVATAR_FRAMES: Record<FrameId, { label: string; colors: [string, string]; cost: number }> = {
  space: { label: "Space",  colors: ["#3DB4F2", "#7B61FF"], cost: 100 },
  cyber: { label: "Cyber",  colors: ["#00FFCC", "#BD00FF"], cost: 150 },
  fire:  { label: "Fire",   colors: ["#FF6B35", "#FF3D71"], cost: 200 },
  gold:  { label: "Gold",   colors: ["#F5A623", "#FFD700"], cost: 300 },
};

export async function purchaseFrame(userId: string, cost: number): Promise<number> {
  const { data: p } = await supabase.from("profiles").select("coins").eq("id", userId).single();
  if (!p) throw new Error("Profile not found");
  if ((p.coins ?? 0) < cost) throw new Error("Not enough coins");
  const newCoins = p.coins - cost;
  await supabase.from("profiles").update({ coins: newCoins }).eq("id", userId);
  return newCoins;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export async function updateAvatarUrl(userId: string, url: string): Promise<void> {
  await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
}

// ─── Refresh Energy (via Edge Function) ──────────────────────────────────────

export async function refreshEnergy(): Promise<{ energy: number; max_energy: number }> {
  const { data, error } = await supabase.functions.invoke("refresh-energy", {
    body: {},
  });
  if (error) throw error;
  return data;
}
