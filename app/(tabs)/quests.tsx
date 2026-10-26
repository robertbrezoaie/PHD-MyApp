import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import {
  getQuestsWithProgress,
  getBadgesWithEarned,
  getLeaderboard,
  getFirstQuestionForQuest,
  type QuestWithProgress,
  type BadgeWithEarned,
} from "../../lib/api";
import { useTheme } from "../../lib/theme";
import type { LeaderboardEntry } from "../../lib/database.types";

const { width } = Dimensions.get("window");

const TIER: Record<string, { colors: [string, string]; label: string; icon: string }> = {
  bronze:  { colors: ["#CD7F32", "#A0522D"], label: "Bronze",  icon: "medal-outline" },
  silver:  { colors: ["#9E9E9E", "#757575"], label: "Silver",  icon: "diamond-outline" },
  gold:    { colors: ["#F5A623", "#FF6B35"], label: "Gold",    icon: "star-four-points" },
  diamond: { colors: ["#3DB4F2", "#7B61FF"], label: "Diamond", icon: "diamond" },
};

const RANK_COLORS = ["#F5A623", "#9E9E9E", "#CD7F32"];

export default function QuestsScreen() {
  const router = useRouter();
  const { isDark, c } = useTheme();
  const [quests, setQuests] = useState<QuestWithProgress[]>([]);
  const [badges, setBadges] = useState<BadgeWithEarned[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // opens on "My rank" (section 10.4: no other learners shown by default)
  const [lbScope, setLbScope] = useState<"global" | "private">("private");
  const [lbCollapsed, setLbCollapsed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const [q, b, l] = await Promise.all([
      getQuestsWithProgress(user.id),
      getBadgesWithEarned(user.id),
      getLeaderboard(),
    ]);
    setQuests(q);
    setBadges(b);
    setLeaderboard(l);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleContinue = async (quest: QuestWithProgress) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const question = await getFirstQuestionForQuest(quest.id);
    router.push({
      pathname: "/task",
      params: {
        questId: quest.id,
        questTitle: quest.title,
        questionId: question?.id ?? "",
        prompt: question?.prompt ?? "",
        hint: question?.hint ?? "",
        xpReward: question?.xp_reward ?? 20,
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <LinearGradient colors={[...c.gradBg]} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb1, { backgroundColor: c.orb1 }]} />
      <View style={[styles.orb2, { backgroundColor: c.orb2 }]} />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Quests</Text>
          <View style={[styles.headerBadge, { backgroundColor: c.accentBg, borderColor: c.accentBorder }]}>
            <Text style={[styles.headerBadgeText, { color: c.accent }]}>{quests.filter(q => !q.completed).length} active</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        >
          {/* Adaptive practice session */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/session");
            }}
          >
            <LinearGradient colors={["#3DB4F2", "#7B61FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.practiceCard}>
              <MaterialCommunityIcons name="brain" size={28} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.practiceTitle}>Practice session</Text>
                <Text style={styles.practiceSub}>12 questions that adapt to you</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Quests */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>My Quests</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.questsRow}
            decelerationRate="fast"
            snapToInterval={width * 0.72 + 14}
          >
            {quests.map((quest) => {
              const tier = TIER[quest.tier] ?? TIER.bronze;
              const progress = Math.min(quest.xp_progress / quest.xp_required, 1);
              return (
                <View key={quest.id} style={[styles.questCard, { borderColor: c.border }]}>
                  <LinearGradient
                    colors={[tier.colors[0] + "80", tier.colors[1] + "30", c.border + "00"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <BlurView intensity={isDark ? 20 : 0} tint={isDark ? "dark" : "light"} style={styles.questCardInner}>
                  <View style={[styles.questCardSolid, { backgroundColor: isDark ? "transparent" : c.surface + "EE" }]} />
                    {/* Tier */}
                    <View style={styles.questTierRow}>
                      <LinearGradient
                        colors={tier.colors}
                        style={styles.tierPill}
                      >
                        <MaterialCommunityIcons name={tier.icon as any} size={12} color="#fff" />
                        <Text style={styles.tierPillText}>  {tier.label}</Text>
                      </LinearGradient>
                      {quest.completed && (
                        <View style={styles.completedPill}>
                          <Ionicons name="checkmark-circle" size={14} color="#00D4AA" />
                          <Text style={styles.completedPillText}> Done</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.questTitle, { color: c.text }]}>{quest.title}</Text>

                    <View style={styles.questXpRow}>
                      <Text style={[styles.questXpText, { color: c.textMuted }]}>{quest.xp_progress} / {quest.xp_required} XP</Text>
                      <Text style={[styles.questXpPct, { color: c.purple }]}>{Math.round(progress * 100)}%</Text>
                    </View>
                    <View style={[styles.questBarBg, { backgroundColor: c.border }]}>
                      <LinearGradient
                        colors={tier.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.questBarFill, { width: `${progress * 100}%` }]}
                      />
                    </View>

                    <View style={styles.rewardsRow}>
                      <View style={styles.rewardItem}>
                        <MaterialCommunityIcons name="star-four-points" size={12} color={c.gold} />
                        <Text style={[styles.rewardText, { color: c.textMuted }]}> {quest.xp_reward} XP</Text>
                      </View>
                      <View style={styles.rewardItem}>
                        <MaterialCommunityIcons name="circle-multiple-outline" size={12} color={c.teal} />
                        <Text style={[styles.rewardText, { color: c.textMuted }]}> {quest.coin_reward} Coins</Text>
                      </View>
                    </View>

                    {/* Button */}
                    {quest.completed ? (
                      <View style={styles.completedBtn}>
                        <Text style={styles.completedBtnText}>Completed ✓</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => handleContinue(quest)} activeOpacity={0.85}>
                        <LinearGradient
                          colors={tier.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.continueBtn}
                        >
                          <Text style={styles.continueBtnText}>Continue Quest</Text>
                          <Ionicons name="arrow-forward" size={14} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </BlurView>
                </View>
              );
            })}
          </ScrollView>

          {/* Badges */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>Badges</Text>
          <View style={styles.badgesGrid}>
            {badges.map((badge) => badge.earned ? (
              /* ── EARNED ── large, glowing, unmissable */
              <View key={badge.id} style={styles.badgeEarnedWrapper}>
                <LinearGradient
                  colors={["#F5A623", "#FF6B35", "#FF3D71"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.badgeEarnedGradBorder}
                >
                  <View style={styles.badgeEarnedInner}>
                    <LinearGradient
                      colors={isDark ? ["#1A1000", "#2A1A00"] : ["#FFF4D9", "#FFF0C0"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.badgeEarnedGlow} />
                    <MaterialCommunityIcons name={badge.icon as any} size={36} color="#F5A623" />
                    <View style={[styles.badgeEarnedCheckmark, { backgroundColor: isDark ? "#1A1000" : "#FFF4D9" }]}>
                      <Ionicons name="checkmark-circle" size={16} color="#F5A623" />
                    </View>
                  </View>
                </LinearGradient>
                <Text style={styles.badgeEarnedLabel}>{badge.name}</Text>
                {badge.earned_at && (
                  <Text style={styles.badgeEarnedDate}>
                    {new Date(badge.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                )}
              </View>
            ) : (
              /* ── LOCKED ── small, muted, barely there */
              <View key={badge.id} style={styles.badgeLockedWrapper}>
                <View style={[styles.badgeLockedCircle, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
                  <MaterialCommunityIcons name={badge.icon as any} size={20} color={c.borderStrong} />
                  <View style={[styles.lockOverlay, { backgroundColor: c.bgSecondary }]}>
                    <Ionicons name="lock-closed" size={10} color={c.textFaint} />
                  </View>
                </View>
                <Text style={[styles.badgeLockedLabel, { color: c.textFaint }]}>{badge.name}</Text>
              </View>
            ))}
          </View>

          {/* Leaderboard */}
          <View style={styles.lbHeaderRow}>
            <Text style={[styles.sectionTitle, { color: c.text, marginBottom: 0 }]}>Leaderboard</Text>
            <TouchableOpacity
              onPress={() => setLbCollapsed(v => !v)}
              style={[styles.collapseBtn, { backgroundColor: c.bgSecondary, borderColor: c.border }]}
            >
              <Ionicons name={lbCollapsed ? "chevron-down" : "chevron-up"} size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Global / Private toggle */}
          <View style={[styles.segmentedControl, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
            {(["global", "private"] as const).map((scope) => (
              <TouchableOpacity
                key={scope}
                style={[styles.segmentBtn, lbScope === scope && { backgroundColor: c.accent }]}
                onPress={() => setLbScope(scope)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, { color: lbScope === scope ? "#fff" : c.textMuted }]}>
                  {scope === "global" ? "Global" : "My Rank"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!lbCollapsed && (
            <View style={[styles.leaderboardCard, { borderColor: c.border }]}>
              <BlurView intensity={isDark ? 20 : 0} tint={isDark ? "dark" : "light"} style={styles.leaderboardBlur}>
                <View style={[styles.leaderboardSolid, { backgroundColor: isDark ? "transparent" : c.surface }]} />
                {(() => {
                  const displayedLb = lbScope === "private"
                    ? leaderboard.filter(p => p.id === currentUserId)
                    : leaderboard;
                  if (displayedLb.length === 0) {
                    return (
                      <Text style={[styles.emptyText, { color: c.textMuted }]}>
                        {lbScope === "private" ? "You're not on the board yet. Complete tasks to earn points!" : "No players yet. Be the first!"}
                      </Text>
                    );
                  }
                  return displayedLb.map((player, idx) => {
                    const globalIdx = leaderboard.findIndex(p => p.id === player.id);
                    const isMe = player.id === currentUserId;
                    return (
                      <View key={player.id}>
                        <View style={[styles.playerRow, isMe && { backgroundColor: c.accentBg }]}>
                          <View style={[styles.rankBadge, { backgroundColor: c.bgSecondary }, globalIdx < 3 && { backgroundColor: RANK_COLORS[globalIdx] + "25" }]}>
                            {globalIdx < 3 ? (
                              <MaterialCommunityIcons name={globalIdx === 0 ? "crown" : "medal"} size={14} color={RANK_COLORS[globalIdx]} />
                            ) : (
                              <Text style={[styles.rankText, { color: c.textMuted }]}>{player.rank}</Text>
                            )}
                          </View>
                          {player.avatar_url?.startsWith("emoji:") ? (
                            <View style={[styles.playerAvatar, { backgroundColor: c.bgSecondary, justifyContent: "center", alignItems: "center" }]}>
                              <Text style={{ fontSize: 22 }}>{player.avatar_url.replace("emoji:", "")}</Text>
                            </View>
                          ) : player.avatar_url ? (
                            <Image source={{ uri: player.avatar_url }} style={styles.playerAvatar} />
                          ) : (
                            <LinearGradient colors={[c.bgSecondary, c.bg]} style={styles.playerAvatar}>
                              <Text style={[styles.playerAvatarInitial, { color: c.textMuted }]}>
                                {(player.username ?? "?")[0].toUpperCase()}
                              </Text>
                            </LinearGradient>
                          )}
                          <Text style={[styles.playerName, { color: isMe ? c.accent : c.textSecondary }, isMe && { fontWeight: "800" }]}>
                            {player.username}{isMe ? " (You)" : ""}
                          </Text>
                          <View style={styles.playerScoreRow}>
                            <MaterialCommunityIcons name="star-four-points" size={12} color={c.gold} />
                            <Text style={[styles.playerScore, { color: c.gold }]}> {(player.points ?? 0).toLocaleString()}</Text>
                          </View>
                        </View>
                        {idx < displayedLb.length - 1 && <View style={[styles.divider, { backgroundColor: c.border }]} />}
                      </View>
                    );
                  });
                })()}
              </BlurView>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080C18" },
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#080C18" },

  orb1: {
    position: "absolute", top: -60, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "#7B61FF18",
  },
  orb2: {
    position: "absolute", top: 400, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "#3DB4F215",
  },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 24, paddingVertical: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#E8F0FF", letterSpacing: -0.5 },
  headerBadge: {
    backgroundColor: "#3DB4F220", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "#3DB4F240",
  },
  headerBadgeText: { fontSize: 12, color: "#3DB4F2", fontWeight: "700" },

  content: { paddingHorizontal: 20 },
  practiceCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, padding: 18, marginBottom: 8 },
  practiceTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  practiceSub: { color: "#ffffffd0", fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#E8F0FF", letterSpacing: -0.3, marginBottom: 14, marginTop: 8 },

  // Quests
  questsRow: { paddingRight: 20, gap: 14, paddingBottom: 4 },
  questCard: {
    width: width * 0.72, borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: "#1E2D45",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    marginBottom: 20,
  },
  questCardInner: { padding: 18, overflow: "hidden" },
  questCardSolid: { ...StyleSheet.absoluteFillObject },
  questTierRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  tierPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tierPillText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  completedPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#00D4AA20", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  completedPillText: { fontSize: 11, color: "#00D4AA", fontWeight: "700" },

  questTitle: { fontSize: 18, fontWeight: "800", color: "#E8F0FF", marginBottom: 14, lineHeight: 24 },
  questXpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  questXpText: { fontSize: 12, color: "#4A6080", fontWeight: "600" },
  questXpPct: { fontSize: 12, color: "#7B61FF", fontWeight: "700" },
  questBarBg: { height: 6, borderRadius: 3, backgroundColor: "#1E2D45", marginBottom: 14, overflow: "hidden" },
  questBarFill: { height: "100%", borderRadius: 3 },

  rewardsRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  rewardItem: { flexDirection: "row", alignItems: "center" },
  rewardText: { fontSize: 12, color: "#4A6080", fontWeight: "600" },

  continueBtn: {
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
  },
  continueBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  completedBtn: {
    backgroundColor: "#00D4AA20", borderRadius: 12, paddingVertical: 12,
    alignItems: "center", borderWidth: 1, borderColor: "#00D4AA40",
  },
  completedBtnText: { color: "#00D4AA", fontSize: 14, fontWeight: "700" },

  // Badges
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 28 },

  // Earned badge
  badgeEarnedWrapper: { alignItems: "center", width: (width - 68) / 3 },
  badgeEarnedGradBorder: {
    width: 80, height: 80, borderRadius: 24, padding: 2.5,
    marginBottom: 8,
    shadowColor: "#F5A623", shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  badgeEarnedInner: {
    flex: 1, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
  },
  badgeEarnedGlow: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#F5A62318",
  },
  badgeEarnedCheckmark: {
    position: "absolute", bottom: 4, right: 4,
    backgroundColor: "#1A1000", borderRadius: 10,
  },
  badgeEarnedLabel: { fontSize: 11, color: "#F5A623", fontWeight: "800", textAlign: "center", letterSpacing: 0.2 },
  badgeEarnedDate: { fontSize: 10, color: "#F5A62380", fontWeight: "500", marginTop: 2 },

  // Locked badge
  badgeLockedWrapper: { alignItems: "center", width: (width - 68) / 3 },
  badgeLockedCircle: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
    marginBottom: 6, position: "relative",
  },
  lockOverlay: {
    position: "absolute", bottom: 3, right: 3,
    borderRadius: 6, padding: 1,
  },
  badgeLockedLabel: { fontSize: 10, fontWeight: "600", textAlign: "center", lineHeight: 13 },

  // Leaderboard header + controls
  lbHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 8 },
  collapseBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  segmentedControl: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 12, padding: 3, gap: 3 },
  segmentBtn: { flex: 1, borderRadius: 9, paddingVertical: 7, alignItems: "center" },
  segmentText: { fontSize: 13, fontWeight: "700" },

  // Leaderboard
  leaderboardCard: { borderRadius: 20, overflow: "hidden", borderWidth: 1, marginBottom: 8 },
  leaderboardBlur: { overflow: "hidden" },
  leaderboardSolid: { ...StyleSheet.absoluteFillObject },
  playerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rankBadge: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: "#1E2D45",
    justifyContent: "center", alignItems: "center",
  },
  rankText: { fontSize: 13, fontWeight: "700", color: "#4A6080" },
  playerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#1E2D45",
    justifyContent: "center", alignItems: "center",
  },
  playerAvatarInitial: { color: "#4A6080", fontWeight: "700", fontSize: 16 },
  playerName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#C8D8F0" },
  playerScoreRow: { flexDirection: "row", alignItems: "center" },
  playerScore: { fontSize: 14, fontWeight: "800", color: "#F5A623" },
  divider: { height: 1, backgroundColor: "#1E2D45", marginHorizontal: 16 },
  emptyText: { padding: 24, textAlign: "center", color: "#4A6080", fontSize: 14 },
});
