import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const XP_PER_LEVEL = 1000;

function calcLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

async function checkAndAwardBadges(
  client: ReturnType<typeof createClient>,
  userId: string,
  profile: Record<string, number>
) {
  const { data: badges } = await client.from("badges").select("*");
  const { data: earned } = await client
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

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
        const { count } = await client
          .from("user_answers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        unlocked = (count ?? 0) >= badge.condition_value;
        break;
      }
    }

    if (unlocked) {
      await client
        .from("user_badges")
        .insert({ user_id: userId, badge_id: badge.id });
      newBadges.push(badge.name);
    }
  }

  return newBadges;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get current user
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { question_id, answer_text, quest_id } = await req.json();

    if (!question_id || !answer_text) {
      return new Response(
        JSON.stringify({ error: "question_id and answer_text are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get question xp_reward
    const { data: question } = await client
      .from("questions")
      .select("xp_reward")
      .eq("id", question_id)
      .single();

    const xpGained = question?.xp_reward ?? 20;

    // Save the answer (upsert in case re-submitted)
    await client.from("user_answers").upsert({
      user_id: user.id,
      question_id,
      answer_text,
    });

    // Fetch current profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("xp, level, points, coins, energy, streak_days, last_active_date")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Compute streak
    const today = new Date().toISOString().split("T")[0];
    const lastActive = profile.last_active_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreakDays =
      lastActive === today
        ? profile.streak_days
        : lastActive === yesterday
        ? profile.streak_days + 1
        : 1;

    // Compute new XP, level, points, coins
    const newXp = profile.xp + xpGained;
    const newLevel = calcLevel(newXp);
    const newPoints = profile.points + xpGained;
    const streakBonus = Math.min(newStreakDays, 10);
    const newCoins = profile.coins + Math.floor(xpGained / 3) + streakBonus;
    const newEnergy = Math.max(0, profile.energy - 10);

    const updatedProfile = {
      xp: newXp,
      level: newLevel,
      points: newPoints,
      coins: newCoins,
      energy: newEnergy,
      streak_days: newStreakDays,
      last_active_date: today,
    };

    await serviceClient
      .from("profiles")
      .update(updatedProfile)
      .eq("id", user.id);

    // Update quest xp progress if quest_id provided
    if (quest_id) {
      const { data: existing } = await serviceClient
        .from("user_quests")
        .select("id, xp_progress, completed")
        .eq("user_id", user.id)
        .eq("quest_id", quest_id)
        .maybeSingle();

      const { data: quest } = await serviceClient
        .from("quests")
        .select("xp_required")
        .eq("id", quest_id)
        .single();

      const newQuestXp = (existing?.xp_progress ?? 0) + xpGained;
      const questCompleted = newQuestXp >= (quest?.xp_required ?? 100);

      if (existing) {
        await serviceClient
          .from("user_quests")
          .update({
            xp_progress: newQuestXp,
            completed: questCompleted,
            completed_at: questCompleted ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);
      } else {
        await serviceClient.from("user_quests").insert({
          user_id: user.id,
          quest_id,
          xp_progress: newQuestXp,
          completed: questCompleted,
          completed_at: questCompleted ? new Date().toISOString() : null,
        });
      }
    }

    // Check badge unlocks
    const fullProfile = { ...profile, ...updatedProfile };
    const newBadges = await checkAndAwardBadges(serviceClient, user.id, fullProfile);

    return new Response(
      JSON.stringify({
        success: true,
        xp_gained: xpGained,
        coins_gained: Math.floor(xpGained / 3) + streakBonus,
        streak_days: newStreakDays,
        level_up: newLevel > profile.level,
        new_level: newLevel,
        new_badges: newBadges,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
