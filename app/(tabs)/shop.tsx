import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { getProfile, purchaseFrame, AVATAR_FRAMES, type FrameId } from "../../lib/api";
import { useTheme } from "../../lib/theme";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - 56) / 2;

export default function ShopScreen() {
  const { isDark, c } = useTheme();
  const [coins, setCoins] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [owned, setOwned] = useState<Set<FrameId>>(new Set());
  const [activeFrame, setActiveFrame] = useState<FrameId | null>(null);
  const [buying, setBuying] = useState<FrameId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [profile, [, ownedVal], [, activeVal]] = await Promise.all([
        getProfile(user.id),
        AsyncStorage.getItem("ownedFrames").then(v => ["ownedFrames", v]),
        AsyncStorage.getItem("activeFrame").then(v => ["activeFrame", v]),
      ] as const);
      if (profile) setCoins(profile.coins);
      if (ownedVal) setOwned(new Set(JSON.parse(ownedVal) as FrameId[]));
      if (activeVal && activeVal in AVATAR_FRAMES) setActiveFrame(activeVal as FrameId);
      setLoading(false);
    };
    init();
  }, []);

  const handlePress = async (frameId: FrameId) => {
    if (!userId || coins === null) return;
    const frame = AVATAR_FRAMES[frameId];

    if (owned.has(frameId)) {
      const next = activeFrame === frameId ? null : frameId;
      setActiveFrame(next);
      await AsyncStorage.setItem("activeFrame", next ?? "");
      return;
    }

    if (coins < frame.cost) {
      Alert.alert("Not Enough Coins", `You need ${frame.cost} coins to unlock this frame. Complete more tasks to earn coins!`);
      return;
    }

    Alert.alert(
      `Unlock ${frame.label} Frame`,
      `Spend ${frame.cost} coins to unlock this avatar frame?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlock",
          onPress: async () => {
            setBuying(frameId);
            try {
              const newCoins = await purchaseFrame(userId, frame.cost);
              const newOwned = new Set(owned);
              newOwned.add(frameId);
              setOwned(newOwned);
              setActiveFrame(frameId);
              setCoins(newCoins);
              await AsyncStorage.setItem("ownedFrames", JSON.stringify([...newOwned]));
              await AsyncStorage.setItem("activeFrame", frameId);
            } catch (err: any) {
              Alert.alert("Purchase Failed", err.message ?? "Something went wrong.");
            } finally {
              setBuying(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <LinearGradient colors={[...c.gradBg]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: c.text }]}>Avatar Shop</Text>
            <Text style={[styles.headerSub, { color: c.textMuted }]}>Customize your profile ring</Text>
          </View>
          <View style={[styles.coinsCard, { backgroundColor: c.goldBg, borderColor: c.goldBorder }]}>
            <MaterialCommunityIcons name="circle-multiple-outline" size={20} color={c.gold} />
            <Text style={[styles.coinsValue, { color: c.gold }]}>{(coins ?? 0).toLocaleString()}</Text>
            <Text style={[styles.coinsLabel, { color: c.textMuted }]}>coins</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Avatar Frames</Text>
          <Text style={[styles.sectionHint, { color: c.textFaint }]}>
            Frames appear as a glowing ring around your avatar.
          </Text>

          <View style={styles.grid}>
            {(Object.keys(AVATAR_FRAMES) as FrameId[]).map((id) => {
              const frame = AVATAR_FRAMES[id];
              const isOwned = owned.has(id);
              const isActive = activeFrame === id;
              const isBuying = buying === id;
              const canAfford = (coins ?? 0) >= frame.cost;

              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.item,
                    { backgroundColor: c.surface, borderColor: isActive ? frame.colors[0] : c.border },
                    isActive && styles.itemActive,
                  ]}
                  onPress={() => handlePress(id)}
                  activeOpacity={0.8}
                >
                  {isActive && (
                    <LinearGradient
                      colors={[frame.colors[0] + "18", frame.colors[1] + "08"]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}

                  {/* Frame preview */}
                  <LinearGradient
                    colors={frame.colors}
                    style={styles.frameRing}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.frameCenter, { backgroundColor: c.bg }]} />
                  </LinearGradient>

                  <Text style={[styles.itemLabel, { color: c.text }]}>{frame.label}</Text>

                  {isBuying ? (
                    <ActivityIndicator size="small" color={c.accent} style={styles.itemStatus} />
                  ) : isOwned ? (
                    <TouchableOpacity
                      onPress={() => handlePress(id)}
                      style={[styles.statusBtn, isActive ? { backgroundColor: frame.colors[0] + "30", borderColor: frame.colors[0] } : { backgroundColor: c.bgSecondary, borderColor: c.border }]}
                    >
                      {isActive && <Ionicons name="checkmark-circle" size={12} color={frame.colors[0]} />}
                      <Text style={[styles.statusBtnText, { color: isActive ? frame.colors[0] : c.textMuted }]}>
                        {isActive ? "Equipped" : "Equip"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.costBtn, !canAfford && { opacity: 0.5 }]}>
                      <MaterialCommunityIcons name="circle-multiple-outline" size={13} color={c.gold} />
                      <Text style={[styles.costText, { color: c.gold }]}>{frame.cost}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.earnCard, { backgroundColor: c.accentBg, borderColor: c.accentBorder }]}>
            <MaterialCommunityIcons name="information-outline" size={18} color={c.accent} />
            <Text style={[styles.earnText, { color: c.textSecondary }]}>
              Earn coins by completing daily tasks and maintaining your streak.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  coinsCard: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8,
  },
  coinsValue: { fontSize: 20, fontWeight: "800" },
  coinsLabel: { fontSize: 13, fontWeight: "500" },

  content: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  sectionHint: { fontSize: 13, marginBottom: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 24 },
  item: {
    width: ITEM_WIDTH, borderRadius: 20, borderWidth: 1.5,
    padding: 20, alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  itemActive: { shadowOpacity: 0.2 },

  frameRing: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  frameCenter: { width: 62, height: 62, borderRadius: 31 },

  itemLabel: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  itemStatus: { marginTop: 4 },

  statusBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  statusBtnText: { fontSize: 12, fontWeight: "700" },
  costBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  costText: { fontSize: 14, fontWeight: "800" },

  earnCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  earnText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
