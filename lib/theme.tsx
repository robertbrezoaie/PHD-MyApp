import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";

// ─── Color palettes ───────────────────────────────────────────────────────────

export const dark = {
  bg:               "#080C18",
  bgSecondary:      "#0D1526",
  surface:          "#0D1526",
  border:           "#1E2D45",
  borderStrong:     "#2A3D55",
  text:             "#E8F0FF",
  textSecondary:    "#C8D8F0",
  textMuted:        "#4A6080",
  textFaint:        "#2A3D55",
  accent:           "#3DB4F2",
  accentBg:         "#3DB4F220",
  accentBorder:     "#3DB4F240",
  gold:             "#F5A623",
  goldBg:           "#F5A62320",
  goldBorder:       "#F5A62340",
  teal:             "#00D4AA",
  tealBg:           "#00D4AA20",
  tealBorder:       "#00D4AA40",
  purple:           "#7B61FF",
  orb1:             "#3DB4F222",
  orb2:             "#7B61FF15",
  tabBar:           "#080C18",
  tabBorder:        "#1E2D45",
  settingsBtn:      "#0D1526",
  settingsBtnBorder:"#1E2D45",
  gradBg:           ["#080C18", "#0D1526", "#0A1020"] as const,
  flashColor:       "#FAFBFF",
};

// Warm sunrise — orange accent, cream background
export const light = {
  bg:               "#FFFBF5",
  bgSecondary:      "#FFF0E0",
  surface:          "#FFFFFF",
  border:           "#EDD8C8",
  borderStrong:     "#D4B89A",
  text:             "#1C0800",
  textSecondary:    "#4A2010",
  textMuted:        "#9B6A50",
  textFaint:        "#D4B89A",
  accent:           "#FF6B35",
  accentBg:         "#FF6B3518",
  accentBorder:     "#FF6B3540",
  gold:             "#D97706",
  goldBg:           "#FFF4D9",
  goldBorder:       "#FFD980",
  teal:             "#059669",
  tealBg:           "#ECFDF5",
  tealBorder:       "#6EE7B7",
  purple:           "#7C3AED",
  orb1:             "#FF6B3520",
  orb2:             "#D9770610",
  tabBar:           "#FFFFFF",
  tabBorder:        "#EDD8C8",
  settingsBtn:      "#FFF0E0",
  settingsBtnBorder:"#EDD8C8",
  gradBg:           ["#FFFBF5", "#FFF4EA", "#FFECE0"] as const,
  flashColor:       "#1C0800",
};

// Matrix terminal — near-black with neon green + magenta
export const cyber = {
  bg:               "#020408",
  bgSecondary:      "#060B14",
  surface:          "#0A1020",
  border:           "#00FF8825",
  borderStrong:     "#00FF8855",
  text:             "#CCFFE8",
  textSecondary:    "#88DDC0",
  textMuted:        "#2A6A4A",
  textFaint:        "#0A2A1A",
  accent:           "#00FF88",
  accentBg:         "#00FF8820",
  accentBorder:     "#00FF8845",
  gold:             "#FFE100",
  goldBg:           "#FFE10018",
  goldBorder:       "#FFE10040",
  teal:             "#00FF88",
  tealBg:           "#00FF8818",
  tealBorder:       "#00FF8840",
  purple:           "#FF00FF",
  orb1:             "#00FF8825",
  orb2:             "#FF00FF18",
  tabBar:           "#020408",
  tabBorder:        "#00FF8820",
  settingsBtn:      "#060B14",
  settingsBtnBorder:"#00FF8830",
  gradBg:           ["#020408", "#060C14", "#020408"] as const,
  flashColor:       "#00FF88",
};

// Zen paper — pure white, neutral grays, electric blue
export const minimal = {
  bg:               "#FAFAFA",
  bgSecondary:      "#F4F4F5",
  surface:          "#FFFFFF",
  border:           "#E4E4E7",
  borderStrong:     "#A1A1AA",
  text:             "#09090B",
  textSecondary:    "#27272A",
  textMuted:        "#71717A",
  textFaint:        "#D4D4D8",
  accent:           "#2563EB",
  accentBg:         "#EFF6FF",
  accentBorder:     "#BFDBFE",
  gold:             "#D97706",
  goldBg:           "#FFFBEB",
  goldBorder:       "#FDE68A",
  teal:             "#059669",
  tealBg:           "#ECFDF5",
  tealBorder:       "#A7F3D0",
  purple:           "#7C3AED",
  orb1:             "#2563EB08",
  orb2:             "#7C3AED05",
  tabBar:           "#FFFFFF",
  tabBorder:        "#E4E4E7",
  settingsBtn:      "#F4F4F5",
  settingsBtnBorder:"#E4E4E7",
  gradBg:           ["#FAFAFA", "#FAFAFA", "#FAFAFA"] as const,
  flashColor:       "#09090B",
};

export type ThemeVariant = "dark" | "light" | "cyber" | "minimal";
// gradBg is a literal tuple in each palette (as const); the shared type only needs three colours.
export type ThemeColors = Omit<typeof dark, "gradBg"> & { gradBg: readonly [string, string, string] };

const PALETTES: Record<ThemeVariant, ThemeColors> = { dark, light, cyber, minimal };

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeCtx {
  isDark: boolean;
  variant: ThemeVariant;
  c: ThemeColors;
  toggleTheme: () => void;
  setThemeVariant: (v: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: true,
  variant: "dark",
  c: dark,
  toggleTheme: () => {},
  setThemeVariant: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [variant, setVariantState] = useState<ThemeVariant>("dark");
  const overlayOpacity = useSharedValue(0);
  const flashColorRef = useRef("#FAFBFF");

  useEffect(() => {
    AsyncStorage.getItem("themeVariant").then((val) => {
      if (val && val in PALETTES) {
        setVariantState(val as ThemeVariant);
      } else {
        // migrate old "theme" key
        AsyncStorage.getItem("theme").then((old) => {
          if (old === "light") setVariantState("light");
        });
      }
    });
  }, []);

  const applyVariant = useCallback((v: ThemeVariant) => {
    setVariantState(v);
    AsyncStorage.setItem("themeVariant", v);
  }, []);

  const setThemeVariant = useCallback((v: ThemeVariant) => {
    const currentPalette = PALETTES[variant];
    flashColorRef.current = currentPalette.flashColor;
    overlayOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 60 }, (finished) => {
        if (finished) runOnJS(applyVariant)(v);
      }),
      withTiming(0, { duration: 380 })
    );
  }, [variant, applyVariant, overlayOpacity]);

  const toggleTheme = useCallback(() => {
    setThemeVariant(variant === "dark" ? "light" : "dark");
  }, [variant, setThemeVariant]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const c = PALETTES[variant];
  const isDark = variant === "dark" || variant === "cyber";

  return (
    <ThemeContext.Provider value={{ isDark, variant, c, toggleTheme, setThemeVariant }}>
      <View style={styles.root}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: flashColorRef.current }, overlayStyle]}
        />
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
});
