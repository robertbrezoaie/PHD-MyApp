import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AVATAR_FRAMES, purchaseFrame, type FrameId } from "../lib/api";

interface Props {
  visible: boolean;
  userId: string;
  coins: number;
  onClose: () => void;
  onCoinsUpdated: (newCoins: number) => void;
  onFrameChanged: (frameId: FrameId | null) => void;
}

export default function ShopModal({ visible, userId, coins, onClose, onCoinsUpdated, onFrameChanged }: Props) {
  const [owned, setOwned] = useState<Set<FrameId>>(new Set());
  const [activeFrame, setActiveFrame] = useState<FrameId | null>(null);
  const [buying, setBuying] = useState<FrameId | null>(null);

  useEffect(() => {
    if (visible) {
      AsyncStorage.multiGet(["ownedFrames", "activeFrame"]).then(([[, ownedVal], [, activeVal]]) => {
        if (ownedVal) setOwned(new Set(JSON.parse(ownedVal) as FrameId[]));
        if (activeVal) setActiveFrame(activeVal as FrameId);
      });
    }
  }, [visible]);

  const handleBuy = async (frameId: FrameId) => {
    const frame = AVATAR_FRAMES[frameId];
    if (owned.has(frameId)) {
      // Toggle equip/unequip
      const next = activeFrame === frameId ? null : frameId;
      setActiveFrame(next);
      await AsyncStorage.setItem("activeFrame", next ?? "");
      onFrameChanged(next);
      return;
    }

    if (coins < frame.cost) {
      Alert.alert("Not Enough Coins", `You need ${frame.cost} coins to unlock this frame.`);
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
              await AsyncStorage.setItem("ownedFrames", JSON.stringify([...newOwned]));
              await AsyncStorage.setItem("activeFrame", frameId);
              onCoinsUpdated(newCoins);
              onFrameChanged(frameId);
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Avatar Shop</Text>
            <View style={styles.coinsRow}>
              <MaterialCommunityIcons name="circle-multiple-outline" size={18} color="#F5A623" />
              <Text style={styles.coinsText}>{coins}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#4A6080" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Avatar Frames</Text>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {(Object.keys(AVATAR_FRAMES) as FrameId[]).map((id) => {
              const frame = AVATAR_FRAMES[id];
              const isOwned = owned.has(id);
              const isActive = activeFrame === id;
              const isBuying = buying === id;

              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.item, isActive && styles.itemActive]}
                  onPress={() => handleBuy(id)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={frame.colors}
                    style={styles.framePreview}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.frameInner} />
                  </LinearGradient>

                  <Text style={styles.itemLabel}>{frame.label}</Text>

                  {isBuying ? (
                    <ActivityIndicator size="small" color="#3DB4F2" style={{ marginTop: 6 }} />
                  ) : isOwned ? (
                    <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeOwned]}>
                      <Text style={styles.badgeText}>{isActive ? "Equipped" : "Equip"}</Text>
                    </View>
                  ) : (
                    <View style={styles.costRow}>
                      <MaterialCommunityIcons name="circle-multiple-outline" size={13} color="#F5A623" />
                      <Text style={styles.costText}>{frame.cost}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0D1526", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1E2D45", alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  title: { flex: 1, color: "#E8F0FF", fontSize: 20, fontWeight: "800" },
  coinsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 12 },
  coinsText: { color: "#F5A623", fontSize: 16, fontWeight: "700" },
  closeBtn: { padding: 4 },
  sectionLabel: { color: "#4A6080", fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  item: { width: "47%", backgroundColor: "#0A1020", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#1E2D45" },
  itemActive: { borderColor: "#3DB4F2", borderWidth: 2 },
  framePreview: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  frameInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#0D1526" },
  itemLabel: { color: "#E8F0FF", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOwned: { backgroundColor: "#1E2D45" },
  badgeActive: { backgroundColor: "#3DB4F230" },
  badgeText: { color: "#3DB4F2", fontSize: 12, fontWeight: "600" },
  costRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  costText: { color: "#F5A623", fontSize: 13, fontWeight: "700" },
});
