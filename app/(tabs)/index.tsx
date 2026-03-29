import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from "react-native";
import { Animated as RNAnimated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import {
  getProfile, getInitialTasks, getNextTask, completeTask, energyCostFor, refreshEnergy,
  AVATAR_FRAMES, type TaskWithCompletion, type FrameId,
} from "../../lib/api";
import { useTheme, type ThemeVariant } from "../../lib/theme";
import AvatarPicker from "../../components/avatar-picker";
import LevelUpOverlay from "../../components/level-up-overlay";
import type { Profile } from "../../lib/database.types";

const { width } = Dimensions.get("window");
const MAX_ENERGY = 100;

const STAT_GRADIENTS: Record<string, [string, string]> = {
  xp:     ["#F5A623", "#FF6B35"],
  energy: ["#3DB4F2", "#7B61FF"],
  coins:  ["#00D4AA", "#00A878"],
  streak: ["#FF6B6B", "#FF8E53"],
};

const THEME_SWATCHES: { key: ThemeVariant; label: string; bg: string; accent: string; textColor: string }[] = [
  { key: "dark",    label: "Dark",    bg: "#0D1526", accent: "#3DB4F2", textColor: "#C8D8F0" },
  { key: "light",   label: "Sunrise", bg: "#FFF4EA", accent: "#FF6B35", textColor: "#6B3A20" },
  { key: "cyber",   label: "Cyber",   bg: "#020408", accent: "#00FF88", textColor: "#A0FFD0" },
  { key: "minimal", label: "Minimal", bg: "#F4F4F5", accent: "#2563EB", textColor: "#374151" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { isDark, variant, c, toggleTheme, setThemeVariant } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayedTasks, setDisplayedTasks] = useState<TaskWithCompletion[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [newLevelNum, setNewLevelNum] = useState(1);
  const [activeFrame, setActiveFrame] = useState<FrameId | null>(null);
  const [microTexts, setMicroTexts] = useState<Record<number, string>>({});

  const userIdRef = useRef<string | null>(null);
  const seenTaskIdsRef = useRef<Set<string>>(new Set());
  const completingSlots = useRef<Set<number>>(new Set());
  const slotAnims = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new RNAnimated.Value(1),
      translateY: new RNAnimated.Value(0),
      glow: new RNAnimated.Value(0),
    }))
  ).current;

  // Dropdown animation
  const dropdownScale = useSharedValue(0.85);
  const dropdownOpacity = useSharedValue(0);

  // Reload active frame whenever the screen comes into focus
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("activeFrame").then((val) => {
      setActiveFrame(val && val in AVATAR_FRAMES ? (val as FrameId) : null);
    });
  }, []));

  const openDropdown = () => {
    setDropdownOpen(true);
    dropdownScale.value = withSpring(1, { damping: 18, stiffness: 300 });
    dropdownOpacity.value = withTiming(1, { duration: 150 });
  };

  const closeDropdown = () => {
    dropdownScale.value = withTiming(0.85, { duration: 120 });
    dropdownOpacity.value = withTiming(0, { duration: 120 }, () => {});
    setTimeout(() => setDropdownOpen(false), 130);
  };

  const dropdownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dropdownScale.value }],
    opacity: dropdownOpacity.value,
  }));

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    userIdRef.current = user.id;
    await refreshEnergy().catch(() => null);
    const [updatedProfile, initialTasks] = await Promise.all([
      getProfile(user.id),
      getInitialTasks(user.id),
    ]);
    setProfile(updatedProfile);
    seenTaskIdsRef.current = new Set(initialTasks.map(t => t.id));
    setDisplayedTasks(initialTasks);
    setCompletedToday(0);
    slotAnims.forEach(a => {
      a.opacity.setValue(1);
      a.translateY.setValue(0);
      a.glow.setValue(0);
    });
  }, [slotAnims]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCompleteTask = useCallback((task: TaskWithCompletion, index: number) => {
    if (completingSlots.current.has(index)) return;
    const userId = userIdRef.current;
    if (!userId) return;
    const energyCost = energyCostFor(task.xp_reward);
    if ((profile?.energy ?? 0) < energyCost) return;
    completingSlots.current.add(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic profile update + level-up detection
    setProfile(prev => {
      if (!prev) return prev;
      const newXp = prev.xp + task.xp_reward;
      const newLevel = Math.floor(newXp / 1000) + 1;
      if (newLevel > prev.level) {
        setNewLevelNum(newLevel);
        setLevelUpVisible(true);
      }
      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        points: prev.points + task.xp_reward,
        coins: prev.coins + Math.floor(task.xp_reward / 3) + Math.min(prev.streak_days ?? 0, 10),
        energy: Math.max(0, prev.energy - energyCost),
      };
    });

    seenTaskIdsRef.current.add(task.id);
    setCompletedToday(n => n + 1);
    completeTask(userId, task.id, task.xp_reward).catch(console.error);

    // Show micro-feedback text
    setMicroTexts(prev => ({ ...prev, [index]: "Nice work! 🔥" }));
    setTimeout(() => setMicroTexts(prev => { const n = { ...prev }; delete n[index]; return n; }), 1800);

    const anim = slotAnims[index];
    RNAnimated.timing(anim.glow, { toValue: 0.4, duration: 400, useNativeDriver: true }).start();

    setTimeout(() => {
      RNAnimated.parallel([
        RNAnimated.timing(anim.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(anim.translateY, { toValue: -12, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(anim.glow, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const nextTask = await getNextTask(userId, [...seenTaskIdsRef.current]);
        setDisplayedTasks(prev => {
          const updated = [...prev];
          if (nextTask) { updated[index] = nextTask; seenTaskIdsRef.current.add(nextTask.id); }
          else updated.splice(index, 1);
          return updated;
        });
        anim.translateY.setValue(18);
        RNAnimated.parallel([
          RNAnimated.timing(anim.opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          RNAnimated.spring(anim.translateY, { toValue: 0, damping: 14, stiffness: 180, useNativeDriver: true }),
        ]).start(() => completingSlots.current.delete(index));
      });
    }, 600);
  }, [slotAnims, profile]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  const xpProgress = profile ? (profile.xp % 1000) / 1000 : 0;
  const energyPercent = profile ? profile.energy / MAX_ENERGY : 0;
  const streakDays = profile?.streak_days ?? 0;

  // Avatar ring colors from active frame
  const ringColors = activeFrame
    ? AVATAR_FRAMES[activeFrame].colors
    : (["#3DB4F2", "#7B61FF", "#F5A623"] as [string, string, string]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <LinearGradient colors={[...c.gradBg]} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb1, { backgroundColor: c.orb1 }]} />
      <View style={[styles.orb2, { backgroundColor: c.orb2 }]} />

      {/* Level-up overlay */}
      <LevelUpOverlay
        visible={levelUpVisible}
        newLevel={newLevelNum}
        onDismiss={() => setLevelUpVisible(false)}
      />

<SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerGreeting, { color: c.textMuted }]}>Welcome back,</Text>
            <Text style={[styles.headerUsername, { color: c.text }]}>{profile?.username ?? "—"}</Text>
          </View>

          {/* Settings button + dropdown */}
          <View style={styles.settingsWrapper}>
            <TouchableOpacity
              style={[styles.settingsBtn, { backgroundColor: c.settingsBtn, borderColor: c.settingsBtnBorder }]}
              onPress={dropdownOpen ? closeDropdown : openDropdown}
            >
              <Ionicons name={dropdownOpen ? "close" : "settings-outline"} size={20} color={c.textMuted} />
            </TouchableOpacity>

            {dropdownOpen && (
              <>
                <TouchableWithoutFeedback onPress={closeDropdown}>
                  <View style={styles.dismissOverlay} />
                </TouchableWithoutFeedback>

                <Animated.View style={[styles.dropdown, { backgroundColor: c.surface, borderColor: c.border }, dropdownStyle]}>
                  {/* Theme picker */}
                  <View style={styles.themeSection}>
                    <Text style={[styles.themeSectionLabel, { color: c.textMuted }]}>Theme</Text>
                    <View style={styles.themeGrid}>
                      {THEME_SWATCHES.map((s) => {
                        const isActive = variant === s.key;
                        return (
                          <TouchableOpacity
                            key={s.key}
                            onPress={() => { closeDropdown(); setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setThemeVariant(s.key); }, 80); }}
                            style={[styles.themeBtn, { backgroundColor: s.bg, borderColor: isActive ? c.accent : c.border }]}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.themePreviewDot, { backgroundColor: s.accent }]} />
                            <Text style={[styles.themeBtnLabel, { color: s.textColor }]} numberOfLines={1}>{s.label}</Text>
                            {isActive && (
                              <View style={[styles.themeCheck, { backgroundColor: c.accent }]}>
                                <Ionicons name="checkmark" size={9} color="#fff" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.dropdownDivider, { backgroundColor: c.border }]} />

                  {/* Sign out row */}
                  <TouchableOpacity
                    style={styles.dropdownRow}
                    onPress={() => {
                      closeDropdown();
                      setTimeout(() =>
                        Alert.alert("Sign Out", "Are you sure?", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
                        ]), 150);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dropdownIcon, { backgroundColor: "#FF3D7115" }]}>
                      <Ionicons name="log-out-outline" size={16} color="#FF3D71" />
                    </View>
                    <Text style={[styles.dropdownLabel, { color: "#FF3D71" }]}>Sign Out</Text>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        >
          {/* Avatar + Level Ring */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={() => setAvatarPickerOpen(true)} activeOpacity={0.85}>
              <View style={[styles.avatarOuterRing, { shadowColor: activeFrame ? AVATAR_FRAMES[activeFrame].colors[0] : c.accent }]}>
                <LinearGradient
                  colors={ringColors as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.avatarGradientRing}
                >
                  <View style={[styles.avatarInner, { backgroundColor: c.bg }]}>
                    {profile?.avatar_url?.startsWith("emoji:") ? (
                      <View style={[styles.avatar, { justifyContent: "center", alignItems: "center", backgroundColor: c.bgSecondary }]}>
                        <Text style={{ fontSize: 52 }}>{profile.avatar_url.replace("emoji:", "")}</Text>
                      </View>
                    ) : profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                      <LinearGradient colors={[c.bgSecondary, c.bg]} style={styles.avatar}>
                        <Text style={[styles.avatarInitial, { color: c.text }]}>
                          {profile?.username?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                </LinearGradient>
              </View>
              <View style={[styles.avatarEditBadge, { backgroundColor: c.accent }]}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.levelBadge}>
              <LinearGradient colors={["#F5A623", "#FF6B35"]} style={styles.levelBadgeGrad}>
                <Text style={styles.levelBadgeText}>LVL {profile?.level ?? 1}</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Avatar Picker Modal */}
          {profile && (
            <AvatarPicker
              visible={avatarPickerOpen}
              userId={profile.id}
              onClose={() => setAvatarPickerOpen(false)}
              onUpdated={(url) => setProfile((p) => p ? { ...p, avatar_url: url } : p)}
            />
          )}

          {/* XP Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={[styles.xpTitle, { color: c.textMuted }]}>Experience Points</Text>
              <Text style={[styles.xpValue, { color: c.purple }]}>{profile?.xp ?? 0} / {(profile?.level ?? 1) * 1000}</Text>
            </View>
            <View style={[styles.xpBarBg, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
              <LinearGradient
                colors={["#3DB4F2", "#7B61FF"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]}
              />
              <View style={[styles.xpGlow, { left: `${Math.max(xpProgress * 100 - 1, 0)}%` }]} />
            </View>
          </View>

          {/* Streak Banner */}
          {streakDays >= 1 && (
            <View style={[styles.streakBanner, { backgroundColor: streakDays >= 7 ? "#FF6B6B20" : c.bgSecondary, borderColor: streakDays >= 7 ? "#FF6B6B40" : c.border }]}>
              <MaterialCommunityIcons name="fire" size={22} color={streakDays >= 7 ? "#FF6B6B" : "#FF8E53"} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakBannerTitle, { color: streakDays >= 7 ? "#FF6B6B" : c.text }]}>
                  {streakDays} Day Streak{streakDays >= 7 ? " 🏆" : ""}
                </Text>
                <Text style={[styles.streakBannerSub, { color: c.textMuted }]}>
                  {streakDays >= 7 ? "You're on fire! Keep it going." : "Complete a task today to keep your streak!"}
                </Text>
              </View>
              <Text style={[styles.streakBonus, { color: streakDays >= 1 ? "#FF8E53" : c.textMuted }]}>
                +{Math.min(streakDays, 10)} coins/task
              </Text>
            </View>
          )}

          {/* Daily Tasks — above stats so they're immediately visible */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Daily Tasks</Text>
              <View style={[styles.taskCountBadge, { backgroundColor: c.bgSecondary }]}>
                <Text style={[styles.taskCountText, { color: c.textMuted }]}>{completedToday} done</Text>
              </View>
            </View>

            {displayedTasks.length === 0 ? (
              /* What's Next card */
              <View style={[styles.whatsNextCard, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
                <LinearGradient
                  colors={[c.accentBg, c.surface]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialCommunityIcons name="check-circle-outline" size={32} color={c.accent} style={{ marginBottom: 10 }} />
                <Text style={[styles.whatsNextTitle, { color: c.text }]}>All tasks done!</Text>
                <Text style={[styles.whatsNextSub, { color: c.textMuted }]}>
                  Pull to refresh for more, or dive into a Quest to keep earning XP.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/quests")}
                  style={[styles.whatsNextBtn, { backgroundColor: c.accent }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.whatsNextBtnText}>Go to Quests</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              displayedTasks.map((task, index) => {
                const anim = slotAnims[index];
                const microText = microTexts[index];
                return (
                  <RNAnimated.View
                    key={task.id}
                    style={{ opacity: anim.opacity, transform: [{ translateY: anim.translateY }] }}
                  >
                    {microText && (
                      <Text style={[styles.microText, { color: c.teal }]}>{microText}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.taskRow, { borderColor: c.border, opacity: (profile?.energy ?? 0) < energyCostFor(task.xp_reward) ? 0.45 : 1 }]}
                      onPress={() => handleCompleteTask(task, index)}
                      activeOpacity={0.7}
                    >
                      <BlurView intensity={isDark ? 25 : 0} tint={isDark ? "dark" : "light"} style={styles.taskBlur}>
                        <View style={[styles.taskBlurSolid, { backgroundColor: isDark ? "transparent" : c.surface }]} />
                        <RNAnimated.View
                          style={[StyleSheet.absoluteFill, { backgroundColor: "#FFD700", opacity: anim.glow, borderRadius: 14 }]}
                        />
                        <View style={[styles.taskCheck, { borderColor: c.border }]} />
                        <Text style={[styles.taskLabel, { color: c.textSecondary }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <View style={styles.taskPills}>
                          <View style={[styles.xpPill, { backgroundColor: c.goldBg, borderColor: c.goldBorder }]}>
                            <Text style={[styles.xpPillText, { color: c.gold }]}>+{task.xp_reward} XP</Text>
                          </View>
                          <View style={[styles.energyPill, (profile?.energy ?? 0) < energyCostFor(task.xp_reward) && styles.energyPillInsufficient]}>
                            <MaterialCommunityIcons name="lightning-bolt" size={10} color={(profile?.energy ?? 0) < energyCostFor(task.xp_reward) ? "#FF6B6B" : c.accent} />
                            <Text style={[styles.energyPillText, { color: (profile?.energy ?? 0) < energyCostFor(task.xp_reward) ? "#FF6B6B" : c.accent }]}>{energyCostFor(task.xp_reward)}</Text>
                          </View>
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  </RNAnimated.View>
                );
              })
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {[
              { label: "Points", value: (profile?.points ?? 0).toLocaleString(), icon: "star-four-points", key: "xp" },
              { label: "Energy", value: `${profile?.energy ?? 0}/${MAX_ENERGY}`, icon: "lightning-bolt", key: "energy", progress: energyPercent },
              { label: "Coins", value: (profile?.coins ?? 0).toLocaleString(), icon: "circle-multiple-outline", key: "coins" },
              { label: "Streak", value: `${streakDays}d`, icon: "fire", key: "streak" },
            ].map((stat) => (
              <View key={stat.key} style={[styles.statCard, { borderColor: c.border }]}>
                <BlurView intensity={isDark ? 30 : 0} tint={isDark ? "dark" : "light"} style={styles.statBlur}>
                  <View style={[styles.statSolid, { backgroundColor: isDark ? "transparent" : c.surface }]} />
                  <LinearGradient
                    colors={[STAT_GRADIENTS[stat.key][0] + "22", STAT_GRADIENTS[stat.key][1] + "11"]}
                    style={styles.statGradOverlay}
                  />
                  <MaterialCommunityIcons name={stat.icon as any} size={20} color={STAT_GRADIENTS[stat.key][0]} style={{ marginBottom: 6 }} />
                  <Text style={[styles.statValue, { color: c.text }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
                  {stat.progress !== undefined && (
                    <View style={[styles.statProgressBg, { backgroundColor: c.border }]}>
                      <LinearGradient
                        colors={STAT_GRADIENTS[stat.key]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.statProgressFill, { width: `${stat.progress * 100}%` }]}
                      />
                    </View>
                  )}
                </BlurView>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity activeOpacity={0.85} style={styles.ctaWrapper} onPress={() => router.push("/(tabs)/quests")}>
            <LinearGradient
              colors={["#3DB4F2", "#7B61FF"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <MaterialCommunityIcons name="rocket-launch-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>  Explore Quests & Badges</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  orb1: { position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: 140 },
  orb2: { position: "absolute", top: 300, left: -100, width: 240, height: 240, borderRadius: 120 },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 16,
  },
  headerGreeting: { fontSize: 13, fontWeight: "500", letterSpacing: 0.5 },
  headerUsername: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },

  settingsWrapper: { position: "relative", zIndex: 100 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  dismissOverlay: { position: "absolute", top: -200, left: -400, right: -20, bottom: -800, zIndex: 99 },
  dropdown: {
    position: "absolute", top: 48, right: 0,
    width: 230, borderRadius: 16, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    overflow: "hidden", zIndex: 200,
    transformOrigin: "top right",
  },
  dropdownRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  dropdownIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  dropdownLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  dropdownDivider: { height: 1, marginHorizontal: 14 },

  themeSection: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  themeSectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  themeBtn: {
    width: "47%", borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  themePreviewDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  themeBtnLabel: { flex: 1, fontSize: 12, fontWeight: "700" },
  themeCheck: { width: 16, height: 16, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  content: { paddingHorizontal: 20 },

  avatarSection: { alignItems: "center", marginTop: 8, marginBottom: 24 },
  avatarOuterRing: { width: 120, height: 120, borderRadius: 60, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  avatarGradientRing: { width: 120, height: 120, borderRadius: 60, padding: 3 },
  avatarInner: { flex: 1, borderRadius: 57, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 57, justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 42, fontWeight: "800" },
  avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  levelBadge: { marginTop: -16, shadowColor: "#F5A623", shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  levelBadgeGrad: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20 },
  levelBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },

  xpSection: { marginBottom: 16 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  xpTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  xpValue: { fontSize: 13, fontWeight: "700" },
  xpBarBg: { height: 8, borderRadius: 4, borderWidth: 1, overflow: "visible" },
  xpBarFill: { height: "100%", borderRadius: 4 },
  xpGlow: { position: "absolute", top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#7B61FF", shadowColor: "#7B61FF", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },

  streakBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 20,
  },
  streakBannerTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  streakBannerSub: { fontSize: 12, lineHeight: 16 },
  streakBonus: { fontSize: 12, fontWeight: "700", textAlign: "right" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  statCard: { width: (width - 50) / 2, borderRadius: 16, overflow: "hidden", borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  statBlur: { padding: 16, overflow: "hidden" },
  statSolid: { ...StyleSheet.absoluteFillObject },
  statGradOverlay: { ...StyleSheet.absoluteFillObject },
  statValue: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  statProgressBg: { height: 4, borderRadius: 2, marginTop: 10, overflow: "hidden" },
  statProgressFill: { height: "100%", borderRadius: 2 },

  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  taskCountBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  taskCountText: { fontSize: 12, fontWeight: "700" },

  microText: { fontSize: 12, fontWeight: "700", marginBottom: 4, marginLeft: 4 },

  taskRow: { borderRadius: 14, overflow: "hidden", marginBottom: 10, borderWidth: 1 },
  taskBlur: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, overflow: "hidden" },
  taskBlurSolid: { ...StyleSheet.absoluteFillObject },
  taskCheck: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  xpPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  xpPillText: { fontSize: 11, fontWeight: "700" },
  taskPills: { flexDirection: "row", gap: 6, alignItems: "center" },
  energyPill: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: "transparent", backgroundColor: "transparent" },
  energyPillInsufficient: { backgroundColor: "#FF6B6B15", borderColor: "#FF6B6B40" },
  energyPillText: { fontSize: 11, fontWeight: "700" },
  taskLabel: { flex: 1, fontSize: 14, fontWeight: "500" },

  whatsNextCard: {
    borderRadius: 18, borderWidth: 1, padding: 24, alignItems: "center", overflow: "hidden",
    shadowColor: "#3DB4F2", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  whatsNextTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  whatsNextSub: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 18 },
  whatsNextBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  whatsNextBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  ctaWrapper: { borderRadius: 16, overflow: "hidden", shadowColor: "#3DB4F2", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ctaGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 16 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
