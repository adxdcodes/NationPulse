import { createContext, useContext, useState, useEffect } from "react";
import { Landmark, Settings2, Coins, Gavel } from "lucide-react";

const ThemeCtx = createContext();
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("np-theme-v2");
      return saved ? saved === "dark" : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("np-theme-v2", dark ? "dark" : "light"); } catch { /* noop */ } }, [dark]);
  return <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
export const FONT_UI = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const FONT_SERIF = "'Source Serif 4', Georgia, Cambria, serif";

const palette = {
  light: { bg: "#FFF8FC", surface: "#FFFFFF", surface2: "#EFCFE3", border: "#946273", borderLight: "#EBD3D6", text: "#2B1620", textSub: "#5C3A47", textMuted: "#7A5663", primary: "#B64F70", primaryHover: "#963D5C", accent: "#B3DEE2", accentBg: "#EAF2D7", accentText: "#35432E", topbar: "#FFFFFF", topbarBorder: "#EFCFE3", shadow: "0 1px 2px rgba(142,38,70,.08)", shadowHover: "0 8px 24px rgba(142,38,70,.14)", danger: "#A33A5D", dangerBg: "#FCE5EC", success: "#4F6638", successBg: "#EAF2D7", warning: "#76531B", warningBg: "#F8E3EA" },
  dark: { bg: "#1F1218", surface: "#2B1A22", surface2: "#38232D", border: "#A8798C", borderLight: "#503340", text: "#FDEBEF", textSub: "#E8CBD4", textMuted: "#C6A5B2", primary: "#EA9AB2", primaryHover: "#E27396", accent: "#B3DEE2", accentBg: "#2E3B37", accentText: "#EAF2D7", topbar: "#2B1A22", topbarBorder: "#503340", shadow: "0 2px 8px rgba(0,0,0,.30)", shadowHover: "0 12px 28px rgba(0,0,0,.45)", danger: "#EA9AB2", dangerBg: "#452832", success: "#EAF2D7", successBg: "#303B2A", warning: "#EA9AB2", warningBg: "#45303A" },
};
export const T = { light: palette.light, dark: palette.dark };

const variants = {
  blue: ["#EFF6FF", "#1D4ED8", "#BFDBFE", "#172554", "#93C5FD", "#1E3A8A"],
  orange: ["#FFF7ED", "#9A3412", "#FED7AA", "#431407", "#FDBA74", "#7C2D12"],
  green: ["#D5F3D8", "#14532D", "#A8D8AF", "#263A2C", "#D5F3D8", "#48744E"],
  purple: ["#FAF5FF", "#6B21A8", "#E9D5FF", "#2E1065", "#D8B4FE", "#581C87"],
  rose: ["#F2C7C7", "#8E2646", "#EBD3D6", "#503340", "#FDEBEF", "#805264"],
  pink: ["#FFB7C5", "#2B1620", "#E48EA1", "#503340", "#FDEBEF", "#805264"],
  red: ["#FFFFFF", "#B42318", "#B42318", "#451F25", "#FF8B82", "#9D4948"],
  whitegreen: ["#FFFFFF", "#1F6B3A", "#1F6B3A", "#263A2C", "#D5F3D8", "#48744E"],
  teal: ["#E7F1F4", "#285766", "#BDD4DB", "#233A42", "#C3E1E8", "#496B75"],
  emerald: ["#E7F2EB", "#315D43", "#BCD5C4", "#263B2F", "#C8E4D1", "#4D6B56"],
  sage: ["#EAF2D7", "#35432E", "#B8C99A", "#303B2A", "#DDECCB", "#667A4A"],
  amber: ["#FFF3DC", "#76531B", "#E6CFA2", "#45391F", "#F3D99E", "#766441"],
  indigo: ["#ECEEFE", "#4C528B", "#C9CCEE", "#333653", "#D3D5FA", "#5B6089"],
  danger: ["#FBEAEA", "#8C3B3B", "#E6BDBD", "#482C2C", "#FFC3B8", "#805352"],
};
const makeMeta = (name, variant) => { const [bg, text, border, dbg, dtext, dborder] = variants[variant]; return { Icon: name, light: { bg, text, border }, dark: { bg: dbg, text: dtext, border: dborder } }; };
export const DOMAIN_META = { Parliament: makeMeta(Landmark, "teal"), Executive: makeMeta(Settings2, "orange"), Budget: makeMeta(Coins, "emerald"), Judiciary: makeMeta(Gavel, "purple") };
export const STATUS_META = {
  "Introduced": makeMeta(null, "rose"), "In Committee": makeMeta(null, "indigo"),
  "Passed": makeMeta(null, "emerald"), "Enacted": makeMeta(null, "teal"),
  "Withdrawn": makeMeta(null, "danger"), "In Effect": makeMeta(null, "sage"),
  "Pending": makeMeta(null, "amber"), "Under Review": makeMeta(null, "indigo"),
  "Struck Down": makeMeta(null, "danger"), "Lapsed": makeMeta(null, "danger"),
  "Announced": makeMeta(null, "blue"), "Upheld": makeMeta(null, "emerald"),
};
export const PARTY_META = { NDA: makeMeta(null, "orange"), INDIA: makeMeta(null, "blue"), Independent: makeMeta(null, "rose"), Regional: makeMeta(null, "purple") };
