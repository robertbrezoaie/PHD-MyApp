import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { submitAnswer, type SubmitAnswerResult } from "../lib/api";
import { useTheme } from "../lib/theme";

export default function TaskScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    questId: string;
    questTitle: string;
    questionId: string;
    prompt: string;
    hint: string;
    xpReward: string;
  }>();

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const xpReward = parseInt(params.xpReward ?? "20", 10);

  const handleSubmit = async () => {
    if (!answer.trim()) {
      Alert.alert("Empty Answer", "Please type your answer before submitting.");
      return;
    }

    if (!params.questionId) {
      Alert.alert("Error", "No question loaded.");
      return;
    }

    setSubmitting(true);
    try {
      const result: SubmitAnswerResult = await submitAnswer(
        params.questionId,
        answer.trim(),
        params.questId
      );

      const badgeMsg = result.new_badges.length > 0
        ? `\n\nNew badge${result.new_badges.length > 1 ? "s" : ""} unlocked: ${result.new_badges.join(", ")}!`
        : "";

      const levelMsg = result.level_up ? `\n\nLevel up! You are now Level ${result.new_level}!` : "";

      Alert.alert(
        "Answer Submitted!",
        `+${result.xp_gained} XP  •  Streak: ${result.streak_days} Days  •  +${result.coins_gained} Coins${levelMsg}${badgeMsg}`,
        [{ text: "Continue", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Submission Failed", err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question Card */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {params.questTitle ?? "Quest"}
          </Text>
          <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
            Answer the question below to earn XP and progress your quest.
          </Text>

          <Text style={[styles.question, { color: c.text }]}>{params.prompt}</Text>

          <TextInput
            style={[styles.textInput, { backgroundColor: c.bgSecondary, color: c.text, borderColor: c.border }]}
            placeholder="Type your answer here..."
            placeholderTextColor={c.textMuted}
            multiline
            textAlignVertical="top"
            value={answer}
            onChangeText={setAnswer}
            editable={!submitting}
          />

          {params.hint ? (
            <Text style={[styles.hint, { color: c.textMuted }]}>Hint: {params.hint}</Text>
          ) : null}
        </View>

        {/* Task Rewards Card */}
        <View style={styles.rewardsCard}>
          <View style={styles.rewardsTitleRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#fff" />
            <Text style={styles.rewardsTitle}> Task Rewards</Text>
          </View>

          <View style={styles.energyRow}>
            <View style={styles.energyBarBg}>
              <View style={[styles.energyBarFill, { width: "45%" }]} />
              <View style={[styles.energyThumb, { left: "45%" }]} />
            </View>
            <Text style={styles.energyLabel}>{`+${xpReward}\nEnergy`}</Text>
          </View>

          <View style={styles.rewardsFooter}>
            <View style={styles.rewardStatRow}>
              <MaterialCommunityIcons name="fire" size={16} color="#FFD700" />
              <Text style={styles.rewardStat}> Streak +1 Day</Text>
            </View>
            <View style={styles.rewardStatRow}>
              <MaterialCommunityIcons name="circle-multiple-outline" size={16} color="#FFD700" />
              <Text style={styles.rewardStat}> Coins +50</Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="rocket-launch-outline" size={20} color="#fff" />
              <Text style={styles.submitText}> Submit Answer</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  content: { padding: 16, gap: 14 },

  card: { borderRadius: 18, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 22, fontWeight: "800", marginBottom: 6, lineHeight: 28 },
  cardSubtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  question: { fontSize: 17, fontWeight: "700", lineHeight: 24, marginBottom: 16 },
  textInput: { borderRadius: 12, borderWidth: 1, padding: 16, fontSize: 15, minHeight: 140, lineHeight: 22, marginBottom: 12 },
  hint: { fontSize: 13, fontStyle: "italic" },

  rewardsCard: { backgroundColor: "#3DB4F2", borderRadius: 16, padding: 16 },
  rewardsTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  rewardsTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  energyRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  energyBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)", position: "relative", overflow: "visible" },
  energyBarFill: { height: "100%", borderRadius: 4, backgroundColor: "#4CAF50" },
  energyThumb: { position: "absolute", top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", marginLeft: -9, elevation: 3 },
  energyLabel: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "right", lineHeight: 18 },
  rewardsFooter: { flexDirection: "row", justifyContent: "space-between" },
  rewardStatRow: { flexDirection: "row", alignItems: "center" },
  rewardStat: { color: "#fff", fontSize: 13, fontWeight: "600" },

  submitButton: { backgroundColor: "#3DB4F2", borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
