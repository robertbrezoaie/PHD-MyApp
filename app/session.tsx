import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import {
  GRADE_CHOICES,
  LearnError,
  currentTask,
  deleteMyLearningData,
  getLearnerSettings,
  giveConsent,
  quitSession,
  startSession,
  submitFirstAnswer,
  submitRetry,
  updateLearnerSettings,
  type Completion,
  type LearnTask,
  type LearnerSettings,
} from "../lib/learn";

// Shown before the first session. Bump consent_version in algorithm.app.json when this text changes.
const CONSENT_VERSION = "v1-draft";
const CONSENT_TEXT =
  "LearnSpace adapts practice questions to each learner. To do this it records your answers, how long " +
  "they take, and which kind of help was shown, under a pseudonymous ID. The records are used to adjust " +
  "difficulty and XP, and for research on adaptive learning. No photos, health or location data are collected. " +
  "Data is kept for the duration of the course, and you can delete it at any time from the settings on this screen.";

type Phase =
  | { kind: "loading" }
  | { kind: "grade" }
  | { kind: "consent" }
  | { kind: "task"; task: LearnTask }
  | { kind: "result"; completion: Completion; outcome: string }
  | { kind: "done"; xp: number }
  | { kind: "error"; message: string };

export default function SessionScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LearnerSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [parentOk, setParentOk] = useState(false);
  const [learnerOk, setLearnerOk] = useState(false);

  const handleError = useCallback((err: unknown) => {
    const code = err instanceof LearnError ? err.code : String(err);
    if (code === "state_mismatch") void currentTask().then((t) => setPhase(t ? { kind: "task", task: t } : { kind: "loading" }));
    else if (code === "needs_grade_band") setPhase({ kind: "grade" });
    else if (code === "needs_consent") setPhase({ kind: "consent" });
    else setPhase({ kind: "error", message: code });
  }, []);

  const begin = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const task = (await currentTask()) ?? (await startSession());
      setPhase(task ? { kind: "task", task } : { kind: "error", message: "No questions are available right now." });
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setSettings(await getLearnerSettings(user.id));
    });
    begin();
  }, [begin]);

  const chooseGrade = async (i: number) => {
    if (!userId) return;
    setBusy(true);
    try {
      await updateLearnerSettings(userId, { grade_band: GRADE_CHOICES[i].band });
      setSettings((s) => (s ? { ...s, grade_band: GRADE_CHOICES[i].band } : s));
      await begin();
    } finally {
      setBusy(false);
    }
  };

  const confirmConsent = async () => {
    setBusy(true);
    try {
      await giveConsent();
      await begin();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const showCompletion = (completion: Completion, outcome: string) => {
    setSessionXp((x) => x + completion.award.xp_gained);
    setPhase({ kind: "result", completion, outcome });
  };

  const submit = async (dontKnow: boolean) => {
    if (phase.kind !== "task") return;
    if (!dontKnow && !answer.trim()) {
      Alert.alert("Empty answer", "Type your answer, or tap “I don't know”.");
      return;
    }
    setBusy(true);
    try {
      const text = dontKnow ? "" : answer.trim();
      if (phase.task.step === "question") {
        const r = await submitFirstAnswer(phase.task.attempt_id, text, dontKnow);
        if (r.outcome === "mistake") setPhase({ kind: "task", task: r.task });
        else showCompletion(r.completion, r.outcome);
      } else {
        const r = await submitRetry(phase.task.attempt_id, text, dontKnow);
        showCompletion(r.completion, r.outcome);
      }
      setAnswer("");
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (phase.kind !== "result") return;
    const n = phase.completion.next;
    setPhase(n ? { kind: "task", task: n } : { kind: "done", xp: sessionXp });
  };

  const endSession = () =>
    Alert.alert("End session?", "The questions left in this session will be skipped.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End session",
        style: "destructive",
        onPress: async () => {
          await quitSession().catch(() => {});
          setShowSettings(false);
          router.back();
        },
      },
    ]);

  const deleteData = () =>
    Alert.alert(
      "Delete my learning data?",
      "This removes your answers, sessions and the help you were shown. Your XP and badges stay. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteMyLearningData();
            setShowSettings(false);
            router.back();
          },
        },
      ],
    );

  const toggleAdaptive = async (adaptive: boolean) => {
    if (!userId) return;
    await updateLearnerSettings(userId, { adaptive });
    setSettings((s) => (s ? { ...s, adaptive } : s));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const card = [styles.card, { backgroundColor: c.surface }];

  const body = (() => {
    switch (phase.kind) {
      case "loading":
        return <ActivityIndicator color={c.accent} size="large" style={{ marginTop: 80 }} />;

      case "error":
        return (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Something went wrong</Text>
            <Text style={[styles.body, { color: c.textMuted }]}>{phase.message}</Text>
            <PrimaryButton label="Try again" onPress={begin} />
          </View>
        );

      case "grade":
        return (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>What grade are you in?</Text>
            <Text style={[styles.body, { color: c.textMuted }]}>This sets how simply the feedback is written.</Text>
            {GRADE_CHOICES.map((g, i) => (
              <TouchableOpacity
                key={g.label}
                style={[styles.choice, { borderColor: c.border, backgroundColor: c.bgSecondary }]}
                onPress={() => chooseGrade(i)}
                disabled={busy}
              >
                <Text style={[styles.choiceText, { color: c.text }]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "consent":
        return (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Before you start</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>{CONSENT_TEXT}</Text>
            <Check label="A parent or guardian has read this and agrees." value={parentOk} onChange={setParentOk} />
            <Check label="I want to take part." value={learnerOk} onChange={setLearnerOk} />
            <Text style={[styles.draft, { color: c.textMuted }]}>Draft text, version {CONSENT_VERSION}: not yet approved.</Text>
            <PrimaryButton label="Continue" onPress={confirmConsent} disabled={!parentOk || !learnerOk || busy} />
          </View>
        );

      case "task": {
        const t = phase.task;
        const isRetry = t.step === "feedback";
        return (
          <>
            {t.difficulty_explanation && !isRetry ? (
              <View style={[styles.note, { backgroundColor: c.accentBg, borderColor: c.accent }]}>
                <MaterialCommunityIcons name="tune-variant" size={16} color={c.accent} />
                <Text style={[styles.noteText, { color: c.text }]}>{t.difficulty_explanation}</Text>
              </View>
            ) : null}
            <View style={card}>
              <Text style={[styles.progress, { color: c.textMuted }]}>
                Question {t.task_in_session} of {t.planned_tasks} · Session {t.session_index}
              </Text>
              <Text style={[styles.question, { color: c.text }]}>{t.prompt}</Text>

              {isRetry && t.feedback ? <FeedbackPanel kind={t.feedback.kind} text={t.feedback.text} /> : null}

              <TextInput
                style={[styles.input, { backgroundColor: c.bgSecondary, color: c.text, borderColor: c.border }]}
                placeholder={isRetry ? "Try again..." : "Type your answer here..."}
                placeholderTextColor={c.textMuted}
                multiline
                textAlignVertical="top"
                value={answer}
                onChangeText={setAnswer}
                editable={!busy}
              />
              <PrimaryButton label={isRetry ? "Submit retry" : "Submit answer"} onPress={() => submit(false)} disabled={busy} busy={busy} />
              <TouchableOpacity onPress={() => submit(true)} disabled={busy} style={styles.dontKnow}>
                <Text style={[styles.dontKnowText, { color: c.textMuted }]}>I don't know</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      }

      case "result": {
        const { completion: r, outcome } = phase;
        const title =
          outcome === "correct" ? "Well done!" : outcome === "ungraded" ? "Answer saved" : "Not quite this time";
        return (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
            <View style={styles.xpRow}>
              <MaterialCommunityIcons name="star-four-points" size={18} color={c.gold} />
              <Text style={[styles.xp, { color: c.gold }]}> +{r.award.xp_gained} XP</Text>
              {r.award.coins_gained > 0 ? (
                <Text style={[styles.coins, { color: c.textMuted }]}>  ·  +{r.award.coins_gained} coins</Text>
              ) : null}
            </View>
            {r.reward_explanation ? (
              <Text style={[styles.rewardWhy, { color: c.textSecondary }]}>{r.reward_explanation}</Text>
            ) : null}
            {r.award.level_up ? <Text style={[styles.body, { color: c.accent }]}>Level up! You are now level {r.award.new_level}.</Text> : null}
            {r.award.new_badges.length > 0 ? (
              <Text style={[styles.body, { color: c.accent }]}>New badge: {r.award.new_badges.join(", ")}</Text>
            ) : null}
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Explanation</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>{r.explanation}</Text>
            <PrimaryButton label={r.next ? "Next question" : "Finish session"} onPress={next} />
          </View>
        );
      }

      case "done":
        return (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Session complete</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>You earned {phase.xp} XP in this session.</Text>
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </View>
        );
    }
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Practice session</Text>
        <TouchableOpacity onPress={() => setShowSettings((v) => !v)} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {showSettings && settings ? (
          <View style={card}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Learning settings</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceText, { color: c.text }]}>Adaptive learning</Text>
                <Text style={[styles.small, { color: c.textMuted }]}>
                  Off: fixed difficulty, no XP bonus, plain feedback. Applies from your next session.
                </Text>
              </View>
              <Switch value={settings.adaptive} onValueChange={toggleAdaptive} />
            </View>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Grade</Text>
            <View style={styles.chips}>
              {GRADE_CHOICES.slice(0, 2).map((g) => (
                <TouchableOpacity
                  key={g.label}
                  style={[styles.chip, { borderColor: c.border }, settings.grade_band === g.band && { backgroundColor: c.accentBg, borderColor: c.accent }]}
                  onPress={() => userId && updateLearnerSettings(userId, { grade_band: g.band }).then(() => setSettings({ ...settings, grade_band: g.band }))}
                >
                  <Text style={[styles.small, { color: c.text }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={endSession} style={styles.linkRow}>
              <Text style={[styles.link, { color: c.accent }]}>End this session</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteData} style={styles.linkRow}>
              <Text style={[styles.link, { color: "#E5484D" }]}>Delete my learning data</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function FeedbackPanel({ kind, text }: { kind: "plain" | "hint" | "example"; text: string | null }) {
  const { c } = useTheme();
  const title = kind === "hint" ? "Hint" : kind === "example" ? "Worked example" : "Not quite right yet";
  return (
    <View style={[styles.feedback, { backgroundColor: c.goldBg, borderColor: c.gold }]}>
      <Text style={[styles.feedbackTitle, { color: c.gold }]}>{title}</Text>
      <Text style={[styles.body, { color: c.text, marginBottom: 0 }]}>{text ?? "Your answer isn't correct yet. Have another go."}</Text>
    </View>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)}>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={value ? c.accent : c.textMuted} />
      <Text style={[styles.checkText, { color: c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <TouchableOpacity style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  iconBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, gap: 14 },

  card: { borderRadius: 18, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 20, fontWeight: "800", marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  small: { fontSize: 13, lineHeight: 18 },
  progress: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  question: { fontSize: 17, fontWeight: "700", lineHeight: 24, marginBottom: 16 },
  input: { borderRadius: 12, borderWidth: 1, padding: 16, fontSize: 15, minHeight: 120, lineHeight: 22, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6, marginBottom: 6 },

  note: { flexDirection: "row", gap: 8, alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 12 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },

  feedback: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  feedbackTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },

  xpRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  xp: { fontSize: 22, fontWeight: "800" },
  coins: { fontSize: 14, fontWeight: "600" },
  rewardWhy: { fontSize: 14, lineHeight: 20, fontStyle: "italic", marginBottom: 12 },

  choice: { borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  choiceText: { fontSize: 15, fontWeight: "600" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  checkText: { flex: 1, fontSize: 15, lineHeight: 21 },
  draft: { fontSize: 12, fontStyle: "italic", marginBottom: 12 },

  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  linkRow: { paddingVertical: 10 },
  link: { fontSize: 15, fontWeight: "600" },

  button: { backgroundColor: "#3DB4F2", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dontKnow: { alignItems: "center", paddingVertical: 12 },
  dontKnowText: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
});
