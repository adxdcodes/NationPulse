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
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
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
    bg: "#F0F4F8", surface: "#FFFFFF", surface2: "#F8FAFC",
    border: "#CBD5E1", borderLight: "#E2E8F0",
    text: "#0F172A", textSub: "#334155", textMuted: "#64748B",
    primary: "#1E3A5F", primaryHover: "#152A47",
    accent: "#0EA5E9", accentBg: "#E0F2FE", accentText: "#0369A1",
    topbar: "#0F1E32", topbarBorder: "#1E3A5F",
    shadow: "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)",
    shadowHover: "0 4px 16px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.08)",
    danger: "#BE123C", dangerBg: "#FFF1F2",
    success: "#15803D", successBg: "#F0FDF4",
  },
  dark: {
    bg: "#060D1A", surface: "#0F1C2E", surface2: "#0A1525",
    border: "#1E3A5F", borderLight: "#172D4A",
    text: "#E2EBF6", textSub: "#94A3B8", textMuted: "#475569",
    primary: "#3B82F6", primaryHover: "#60A5FA",
    accent: "#38BDF8", accentBg: "#0C2A3D", accentText: "#7DD3FC",
    topbar: "#040C18", topbarBorder: "#0F1C2E",
    shadow: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
    shadowHover: "0 4px 20px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
    danger: "#FB7185", dangerBg: "#2A0A0A",
    success: "#4ADE80", successBg: "#052012",
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
