// XP, level, points, coins, streak and badges for one learning task.
// Same rules as submit-answer/index.ts (XP_PER_LEVEL, streak, coins = xp/3 + streak bonus, badge checks),
// without the energy cost: a 12-task session would otherwise use more energy than the maximum.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { XpAward } from "../_shared/engine/store.ts";

const XP_PER_LEVEL = 1000;

function calcLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

async function checkAndAwardBadges(
  client: SupabaseClient,
  userId: string,
  profile: { xp: number; level: number; streak_days: number },
): Promise<string[]> {
  const { data: badges } = await client.from("badges").select("*");
  const { data: earned } = await client.from("user_badges").select("badge_id").eq("user_id", userId);
  const earnedIds = new Set((earned ?? []).map((b: { badge_id: string }) => b.badge_id));
  const newBadges: string[] = [];

  for (const badge of badges ?? []) {
    if (earnedIds.has(badge.id)) continue;
    let unlocked = false;
    switch (badge.condition_type) {
      case "xp_total":
        unlocked = profile.xp >= badge.condition_value;
        break;
      case "streak_days":
        unlocked = profile.streak_days >= badge.condition_value;
        break;
      case "level":
        unlocked = profile.level >= badge.condition_value;
        break;
      case "quests_completed": {
        const { count } = await client
          .from("user_quests")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("completed", true);
        unlocked = (count ?? 0) >= badge.condition_value;
        break;
      }
      case "answers_submitted": {
        const { count } = await client.from("user_answers").select("*", { count: "exact", head: true }).eq("user_id", userId);
        unlocked = (count ?? 0) >= badge.condition_value;
        break;
      }
    }
    if (unlocked) {
      await client.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
      newBadges.push(badge.name);
    }
  }
  return newBadges;
}

export async function awardXp(client: SupabaseClient, userId: string, xpGained: number, now: Date): Promise<XpAward> {
  const { data: profile, error } = await client
    .from("profiles")
    .select("xp, level, points, coins, streak_days, last_active_date")
    .eq("id", userId)
    .single();
  if (error || !profile) throw new Error(`profile not found: ${error?.message ?? userId}`);

  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
  const newStreakDays =
    profile.last_active_date === today
      ? profile.streak_days
      : profile.last_active_date === yesterday
      ? profile.streak_days + 1
      : 1;

  const newXp = profile.xp + xpGained;
  const newLevel = calcLevel(newXp);
  const streakBonus = Math.min(newStreakDays, 10);
  const coinsGained = Math.floor(xpGained / 3) + streakBonus;
  const updated = {
    xp: newXp,
    level: newLevel,
    points: profile.points + xpGained,
    coins: profile.coins + coinsGained,
    streak_days: newStreakDays,
    last_active_date: today,
  };
  await client.from("profiles").update(updated).eq("id", userId);
  const newBadges = await checkAndAwardBadges(client, userId, { ...profile, ...updated });

  return {
    xp_gained: xpGained,
    coins_gained: coinsGained,
    streak_days: newStreakDays,
    level_up: newLevel > profile.level,
    new_level: newLevel,
    new_badges: newBadges,
  };
}
