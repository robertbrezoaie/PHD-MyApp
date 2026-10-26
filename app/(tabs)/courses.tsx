import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import type { FreshLearnCourse } from "../../lib/api";
import { useTheme } from "../../lib/theme";

const { width } = Dimensions.get("window");

export default function CoursesScreen() {
  const { isDark, c } = useTheme();
  const [courses, setCourses] = useState<FreshLearnCourse[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [flMember, setFlMember] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    setUserEmail(session?.user?.email ?? null);
    const { data, error: fnError } = await supabase.functions.invoke("freshlearn-progress", {
      body: {},
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (fnError) throw fnError;
    if (data?.error) throw new Error(data.error);
    setCourses(data.courses ?? []);
    setFlMember(data.member ?? null);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e?.message ?? "Failed to load courses"))
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((e) => setError(e?.message ?? "Failed to load courses"));
    setRefreshing(false);
  }, [load]);

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: c.text }]}>My Courses</Text>
          <View style={[styles.headerBadge, { backgroundColor: c.accentBg, borderColor: c.accentBorder }]}>
            <Text style={[styles.headerBadgeText, { color: c.accent }]}>{courses.length} enrolled</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        >
          {/* User info card */}
          {userEmail && (
            <View style={[styles.userCard, { borderColor: c.border }]}>
              <BlurView intensity={isDark ? 20 : 0} tint={isDark ? "dark" : "light"} style={styles.userCardBlur}>
                <View style={[styles.userCardSolid, { backgroundColor: isDark ? "transparent" : c.surface }]} />
                <View style={styles.userCardRow}>
                  <LinearGradient colors={["#3DB4F2", "#7B61FF"]} style={styles.userAvatar}>
                    <Text style={styles.userAvatarInitial}>{userEmail[0].toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userLabel, { color: c.textMuted }]}>Signed in as</Text>
                    <Text style={[styles.userEmail, { color: c.text }]} numberOfLines={1}>{userEmail}</Text>
                  </View>
                  <View style={[styles.platformBadge, { backgroundColor: "#7B61FF20", borderColor: "#7B61FF40" }]}>
                    <MaterialCommunityIcons name="school-outline" size={12} color="#7B61FF" />
                    <Text style={styles.platformBadgeText}>FreshLearn</Text>
                  </View>
                </View>
              </BlurView>
            </View>
          )}

          {/* Error state */}
          {error && (
            <View style={[styles.emptyCard, { borderColor: c.border }]}>
              <Ionicons name="warning-outline" size={36} color="#FF3D71" />
              <Text style={[styles.emptyTitle, { color: c.text }]}>Could not load courses</Text>
              <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>{error}</Text>
            </View>
          )}

          {/* Empty state */}
          {!error && courses.length === 0 && (
            <View style={[styles.emptyCard, { borderColor: c.border }]}>
              <MaterialCommunityIcons name="school-outline" size={40} color={c.textFaint} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>No completed courses yet</Text>
              <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
                Courses you finish on FreshLearn will appear here automatically.
              </Text>
            </View>
          )}

          {/* Course list */}
          {courses.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Progress</Text>
              {courses.map((course, idx) => {
                const pct = Math.min(Math.max(course.progress ?? 0, 0), 100);
                const isComplete = pct >= 100;
                return (
                  <View key={course.courseId ?? idx} style={[styles.courseCard, { borderColor: c.border }]}>
                    <BlurView intensity={isDark ? 20 : 0} tint={isDark ? "dark" : "light"} style={styles.courseCardBlur}>
                      <View style={[styles.courseCardSolid, { backgroundColor: isDark ? "transparent" : c.surface }]} />

                      <View style={styles.courseTitleRow}>
                        <View style={[styles.courseIconWrap, { backgroundColor: isComplete ? "#00D4AA20" : c.accentBg }]}>
                          <MaterialCommunityIcons
                            name={isComplete ? "check-circle-outline" : "play-circle-outline"}
                            size={22}
                            color={isComplete ? "#00D4AA" : c.accent}
                          />
                        </View>
                        <Text style={[styles.courseName, { color: c.text }]} numberOfLines={2}>
                          {course.courseName ?? "Untitled Course"}
                        </Text>
                        {isComplete && (
                          <View style={styles.completedPill}>
                            <Text style={styles.completedPillText}>Done</Text>
                          </View>
                        )}
                      </View>

                      {/* Progress bar */}
                      <View style={styles.progressRow}>
                        <View style={[styles.progressBarBg, { backgroundColor: c.border }]}>
                          <LinearGradient
                            colors={isComplete ? ["#00D4AA", "#00B894"] : ["#3DB4F2", "#7B61FF"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.progressBarFill, { width: `${pct}%` }]}
                          />
                        </View>
                        <Text style={[styles.progressPct, { color: isComplete ? "#00D4AA" : c.accent }]}>
                          {pct}%
                        </Text>
                      </View>

                      {/* Meta row */}
                      <View style={styles.metaRow}>
                        {course.completionDate && (
                          <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={12} color={c.textFaint} />
                            <Text style={[styles.metaText, { color: c.textFaint }]}>
                              {" "}Completed {new Date(course.completionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </Text>
                          </View>
                        )}
                        {course.rating != null && (
                          <View style={styles.metaItem}>
                            <Ionicons name="star" size={12} color="#F5A623" />
                            <Text style={[styles.metaText, { color: c.textFaint }]}> {course.rating}/5</Text>
                          </View>
                        )}
                      </View>
                    </BlurView>
                  </View>
                );
              })}
            </>
          )}

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
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  headerBadge: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  headerBadgeText: { fontSize: 12, fontWeight: "700" },

  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginBottom: 14, marginTop: 8 },

  // User card
  userCard: { borderRadius: 18, overflow: "hidden", borderWidth: 1, marginBottom: 24 },
  userCardBlur: { overflow: "hidden" },
  userCardSolid: { ...StyleSheet.absoluteFillObject },
  userCardRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  userAvatarInitial: { color: "#fff", fontWeight: "800", fontSize: 18 },
  userInfo: { flex: 1 },
  userLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  userEmail: { fontSize: 14, fontWeight: "700" },
  platformBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  platformBadgeText: { fontSize: 11, fontWeight: "700", color: "#7B61FF" },

  // Empty / error
  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 36,
    alignItems: "center", gap: 10, marginTop: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  // Course card
  courseCard: {
    borderRadius: 18, overflow: "hidden", borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  courseCardBlur: { overflow: "hidden" },
  courseCardSolid: { ...StyleSheet.absoluteFillObject },

  courseTitleRow: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 12, gap: 12 },
  courseIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  courseName: { flex: 1, fontSize: 15, fontWeight: "700", lineHeight: 21 },
  completedPill: {
    backgroundColor: "#00D4AA20", borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: "#00D4AA40",
  },
  completedPillText: { fontSize: 11, color: "#00D4AA", fontWeight: "700" },

  progressRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  progressBarBg: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: "800", minWidth: 38, textAlign: "right" },

  metaRow: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 14 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 12, fontWeight: "500" },
});
