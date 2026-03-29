import React, { useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
} from "react-native-reanimated";

interface Props {
  visible: boolean;
  newLevel: number;
  onDismiss: () => void;
}

export default function LevelUpOverlay({ visible, newLevel, onDismiss }: Props) {
  const badgeScale = useSharedValue(0);
  const badgeRotate = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      badgeScale.value = 0;
      badgeRotate.value = 0;
      textOpacity.value = 0;
      btnOpacity.value = 0;
      pulse.value = 1;

      badgeScale.value = withSpring(1, { damping: 10, stiffness: 120 });
      badgeRotate.value = withSequence(
        withTiming(-0.15, { duration: 150 }),
        withTiming(0.15, { duration: 150 }),
        withTiming(0, { duration: 100 })
      );
      textOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
      btnOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
      pulse.value = withDelay(400, withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1,
        true
      ));
    }
  }, [visible]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: badgeScale.value },
      { rotate: `${badgeRotate.value}rad` },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 12 }],
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: (1 - btnOpacity.value) * 10 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Stars */}
          <Text style={[styles.star, styles.starTL]}>✦</Text>
          <Text style={[styles.star, styles.starTR]}>✦</Text>
          <Text style={[styles.star, styles.starBL]}>✧</Text>
          <Text style={[styles.star, styles.starBR]}>✧</Text>

          <Animated.View style={[styles.badgeWrap, pulseStyle]}>
            <Animated.View style={badgeStyle}>
              <LinearGradient
                colors={["#F5A623", "#FFD700"]}
                style={styles.badge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </Animated.View>

          <Animated.View style={textStyle}>
            <Text style={styles.levelUpLabel}>LEVEL UP!</Text>
            <Text style={styles.levelNumber}>Level {newLevel}</Text>
            <Text style={styles.subtitle}>You're on fire! Keep pushing forward.</Text>
          </Animated.View>

          <Animated.View style={[styles.btnWrap, btnStyle]}>
            <TouchableOpacity onPress={onDismiss} activeOpacity={0.85}>
              <LinearGradient
                colors={["#3DB4F2", "#7B61FF"]}
                style={styles.btn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.btnText}>Keep Going!</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: 300,
    backgroundColor: "#0D1526",
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    overflow: "hidden",
  },
  star: { position: "absolute", color: "#F5A623", fontSize: 18, opacity: 0.6 },
  starTL: { top: 16, left: 20 },
  starTR: { top: 16, right: 20 },
  starBL: { bottom: 80, left: 20 },
  starBR: { bottom: 80, right: 20 },
  badgeWrap: { marginBottom: 24 },
  badge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  levelUpLabel: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 6,
  },
  levelNumber: {
    color: "#E8F0FF",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#4A6080",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  btnWrap: { width: "100%" },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
