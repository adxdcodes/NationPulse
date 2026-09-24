import { createContext, useContext, useState, useEffect } from "react";
import {
  Landmark, Settings2, Coins, Gavel,
} from "lucide-react";

const ThemeCtx = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("np-theme");
      if (saved) return saved === "dark";
      return true; // Pulse AI midnight theme by default; user preference still persists
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("np-theme", dark ? "dark" : "light"); } catch { /* noop */ }
  }, [dark]);

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);

// Design tokens. Editorial navy identity: Inter for UI/body, Source Serif 4
// for headlines and long-form reading (bill titles, summaries) to give the
// reporting content a distinct, journalistic register from the chrome
// around it.
export const FONT_UI = "'Inter', system-ui, sans-serif";
export const FONT_SERIF = "'Source Serif 4', Georgia, serif";

export const T = {
  light: {
    bg: "#F3F7FF", surface: "#FFFFFF", surface2: "#EBF2FF",
    border: "#D5E2F6", borderLight: "#E3EBF8",
    text: "#172844", textSub: "#425775", textMuted: "#7386A3",
    primary: "#3568DA", primaryHover: "#2455C2",
    accent: "#4278E8", accentBg: "#EDF4FF", accentText: "#2458C6",
    topbar: "#142F65", topbarBorder: "#3159A0",
    shadow: "0 7px 28px rgba(23,52,108,.065)",
    shadowHover: "0 16px 44px rgba(24,63,142,.16)",
    danger: "#C33557", dangerBg: "#FFF0F3",
    success: "#18845B", successBg: "#E9F8F1",
  },
  dark: {
    bg: "#0D1525", surface: "#182235", surface2: "#202D46",
    border: "#364967", borderLight: "#2C3B55",
    text: "#F1F5FF", textSub: "#C2CDE1", textMuted: "#94A4BF",
    primary: "#80B4FF", primaryHover: "#A2CAFF",
    accent: "#83BAFF", accentBg: "#233D63", accentText: "#B9D8FF",
    topbar: "#111D32", topbarBorder: "#334766",
    shadow: "0 8px 30px rgba(2,9,23,.19)",
    shadowHover: "0 18px 55px rgba(0,5,19,.39)",
    danger: "#FF8DA4", dangerBg: "#472638",
    success: "#6DDDB0", successBg: "#1B443B",
  },
};

export const DOMAIN_META = {
  Parliament: {
    Icon: Landmark,
    light: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
    dark: { bg: "#0C1B3A", text: "#93C5FD", border: "#1E3A5F" },
  },
  Executive: {
    Icon: Settings2,
    light: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
    dark: { bg: "#2A1500", text: "#FB923C", border: "#431B00" },
  },
  Budget: {
    Icon: Coins,
    light: { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
    dark: { bg: "#052012", text: "#4ADE80", border: "#064E27" },
  },
  Judiciary: {
    Icon: Gavel,
    light: { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
    dark: { bg: "#1A0A2E", text: "#C084FC", border: "#2E1065" },
  },
};

export const STATUS_META = {
  "Passed": { light: { bg: "#F0FDF4", text: "#15803D" }, dark: { bg: "#052012", text: "#4ADE80" } },
  "In Effect": { light: { bg: "#EFF6FF", text: "#1D4ED8" }, dark: { bg: "#0C1B3A", text: "#93C5FD" } },
  "Pending": { light: { bg: "#FFF7ED", text: "#C2410C" }, dark: { bg: "#2A1500", text: "#FB923C" } },
  "Under Review": { light: { bg: "#FAF5FF", text: "#7E22CE" }, dark: { bg: "#1A0A2E", text: "#C084FC" } },
  "Struck Down": { light: { bg: "#FFF1F2", text: "#BE123C" }, dark: { bg: "#2A0A0A", text: "#FB7185" } },
  "Announced": { light: { bg: "#ECFEFF", text: "#0E7490" }, dark: { bg: "#022C3A", text: "#67E8F9" } },
  "Upheld": { light: { bg: "#F0FDF4", text: "#15803D" }, dark: { bg: "#052012", text: "#4ADE80" } },
};

export const PARTY_META = {
  "NDA": { light: { bg: "#FFF7ED", text: "#C2410C" }, dark: { bg: "#2A1500", text: "#FB923C" } },
  "INDIA": { light: { bg: "#EFF6FF", text: "#1D4ED8" }, dark: { bg: "#0C1B3A", text: "#93C5FD" } },
  "Independent": { light: { bg: "#F8FAFC", text: "#475569" }, dark: { bg: "#0A1525", text: "#94A3B8" } },
  "Regional": { light: { bg: "#FAF5FF", text: "#7E22CE" }, dark: { bg: "#1A0A2E", text: "#C084FC" } },
};
