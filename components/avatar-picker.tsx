import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { uploadAvatarPhoto, updateAvatarUrl } from "../lib/api";

const { width } = Dimensions.get("window");

// ─── Monster collection (DiceBear bottts) ────────────────────────────────────

const MONSTERS = [
  { seed: "Zorgon",   label: "Zorgon"   },
  { seed: "Blorp",    label: "Blorp"    },
  { seed: "Fizzbang", label: "Fizzbang" },
  { seed: "Squibble", label: "Squibble" },
  { seed: "Wumbo",    label: "Wumbo"    },
  { seed: "Glarb",    label: "Glarb"    },
  { seed: "Snorkel",  label: "Snorkel"  },
  { seed: "Quibble",  label: "Quibble"  },
  { seed: "Zappity",  label: "Zappity"  },
  { seed: "Bloop",    label: "Bloop"    },
  { seed: "Wibble",   label: "Wibble"   },
  { seed: "Flarbnox", label: "Flarbnox" },
  { seed: "Zingo",    label: "Zingo"    },
  { seed: "Snarf",    label: "Snarf"    },
  { seed: "Blipster", label: "Blipster" },
  { seed: "Gurblax",  label: "Gurblax"  },
  { seed: "Meeple",   label: "Meeple"   },
  { seed: "Grumkin",  label: "Grumkin"  },
];

const monsterUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/bottts/png?seed=${seed}&size=200&backgroundColor=transparent`;

// ─── Emoji collection ────────────────────────────────────────────────────────

const EMOJIS = [
  "👾","🤖","👻","🦄","🐸","🦊","🐺","🦁","🐯","🐼",
  "🐙","🦈","🦋","🐲","🎭","🔥","⚡","🌙","⭐","🎪",
  "🐻","🦝","🦅","🐬","🦩","🐨","🦏","🦖","🧸","🪄",
];

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = "photo" | "emoji" | "monsters";

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onUpdated: (url: string) => void;
}

export default function AvatarPicker({ visible, userId, onClose, onUpdated }: Props) {
  const { isDark, c } = useTheme();
  const [tab, setTab] = useState<Tab>("monsters");
  const [loading, setLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<string | null>(null);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setLoading(true);
    try {
      const url = await uploadAvatarPhoto(userId, result.assets[0].uri);
      onUpdated(url);
      onClose();
    } catch (e: any) {
      Alert.alert("Upload failed", e.message ?? "Could not upload photo. Make sure the avatars storage bucket exists in Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmoji = async () => {
    if (!selectedEmoji) return;
    setLoading(true);
    const url = `emoji:${selectedEmoji}`;
    await updateAvatarUrl(userId, url);
    onUpdated(url);
    setLoading(false);
    onClose();
  };

  const handleConfirmMonster = async () => {
    if (!selectedMonster) return;
    setLoading(true);
    const url = monsterUrl(selectedMonster);
    await updateAvatarUrl(userId, url);
    onUpdated(url);
    setLoading(false);
    onClose();
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "monsters", label: "Monsters", icon: "alien-outline" },
    { key: "emoji",    label: "Emoji",    icon: "emoticon-outline" },
    { key: "photo",    label: "Photo",    icon: "image-outline" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>Choose Avatar</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.bgSecondary }]}>
            <Ionicons name="close" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={[styles.tabBar, { backgroundColor: c.bgSecondary }]}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && { backgroundColor: c.surface }]}
              onPress={() => setTab(t.key)}
            >
              <MaterialCommunityIcons
                name={t.icon as any}
                size={16}
                color={tab === t.key ? c.accent : c.textMuted}
              />
              <Text style={[styles.tabLabel, { color: tab === t.key ? c.text : c.textMuted }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Photo tab ── */}
        {tab === "photo" && (
          <View style={styles.photoTab}>
            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: c.accent, backgroundColor: c.accentBg }]}
              onPress={handlePickPhoto}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={c.accent} size="large" />
              ) : (
                <>
                  <LinearGradient colors={["#3DB4F2", "#7B61FF"]} style={styles.photoIconCircle}>
                    <Ionicons name="image-outline" size={32} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.photoBtnTitle, { color: c.text }]}>Choose from Library</Text>
                  <Text style={[styles.photoBtnSub, { color: c.textMuted }]}>Square crop recommended</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Emoji tab ── */}
        {tab === "emoji" && (
          <View style={styles.emojiTab}>
            <ScrollView contentContainerStyle={styles.emojiGrid} showsVerticalScrollIndicator={false}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiItem,
                    { backgroundColor: c.bgSecondary },
                    selectedEmoji === emoji && { borderColor: c.accent, borderWidth: 2, backgroundColor: c.accentBg },
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, !selectedEmoji && { opacity: 0.4 }]}
              onPress={handleConfirmEmoji}
              disabled={!selectedEmoji || loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3DB4F2", "#7B61FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGrad}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Set as Avatar</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Monsters tab ── */}
        {tab === "monsters" && (
          <View style={styles.monstersTab}>
            <ScrollView contentContainerStyle={styles.monstersGrid} showsVerticalScrollIndicator={false}>
              {MONSTERS.map((m) => (
                <TouchableOpacity
                  key={m.seed}
                  style={[
                    styles.monsterItem,
                    { backgroundColor: c.bgSecondary },
                    selectedMonster === m.seed && { borderColor: c.accent, borderWidth: 2.5 },
                  ]}
                  onPress={() => setSelectedMonster(m.seed)}
                  activeOpacity={0.7}
                >
                  {/* Gradient background for monster */}
                  <LinearGradient
                    colors={selectedMonster === m.seed ? ["#3DB4F220", "#7B61FF20"] : [c.bgSecondary, c.bgSecondary]}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
                  <MonsterImage uri={monsterUrl(m.seed)} />
                  <Text style={[styles.monsterLabel, { color: selectedMonster === m.seed ? c.accent : c.textMuted }]}>
                    {m.label}
                  </Text>
                  {selectedMonster === m.seed && (
                    <View style={styles.monsterCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={c.accent} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, !selectedMonster && { opacity: 0.4 }]}
              onPress={handleConfirmMonster}
              disabled={!selectedMonster || loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3DB4F2", "#7B61FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGrad}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Set as Avatar</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
    </Modal>
  );
}

// Lazy image with fallback
function MonsterImage({ uri }: { uri: string }) {
  const [loaded, setLoaded] = useState(false);
  const { c } = useTheme();
  return (
    <View style={styles.monsterImgContainer}>
      {!loaded && <MaterialCommunityIcons name="alien-outline" size={32} color={c.border} style={styles.monsterPlaceholder} />}
      <Image
        source={{ uri }}
        style={[styles.monsterImg, !loaded && { opacity: 0 }]}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

const ITEM_SIZE = (width - 48 - 24) / 3; // 3 columns with padding

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0,
    paddingBottom: 40, height: "82%",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -8 },
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  tabBar: { flexDirection: "row", marginHorizontal: 20, borderRadius: 14, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 11 },
  tabLabel: { fontSize: 13, fontWeight: "600" },

  // Photo
  photoTab: { paddingHorizontal: 20, paddingBottom: 8 },
  photoBtn: {
    borderWidth: 2, borderStyle: "dashed", borderRadius: 20,
    paddingVertical: 40, alignItems: "center", gap: 12,
  },
  photoIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  photoBtnTitle: { fontSize: 17, fontWeight: "700" },
  photoBtnSub: { fontSize: 13 },

  // Emoji
  emojiTab: { flex: 1, paddingHorizontal: 20 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 16 },
  emojiItem: {
    width: (width - 80) / 5, aspectRatio: 1,
    borderRadius: 14, justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  emojiText: { fontSize: 28 },

  // Monsters
  monstersTab: { flex: 1, paddingHorizontal: 20 },
  monstersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 16 },
  monsterItem: {
    width: ITEM_SIZE, height: ITEM_SIZE + 24,
    borderRadius: 16, alignItems: "center", justifyContent: "center",
    overflow: "hidden", borderWidth: 2, borderColor: "transparent",
    position: "relative",
  },
  monsterImgContainer: { width: ITEM_SIZE - 16, height: ITEM_SIZE - 32, justifyContent: "center", alignItems: "center" },
  monsterImg: { width: "100%", height: "100%", resizeMode: "contain" },
  monsterPlaceholder: { position: "absolute" },
  monsterLabel: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  monsterCheck: { position: "absolute", top: 4, right: 4 },

  // Confirm button
  confirmBtn: { marginHorizontal: 0, marginTop: 12, borderRadius: 14, overflow: "hidden" },
  confirmGrad: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
