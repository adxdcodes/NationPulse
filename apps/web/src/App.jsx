import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme, T } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { TopBar } from "./components/UI.jsx";
import { ErrorBoundary } from "./pages/ErrorPages.jsx";
import NotFound from "./pages/ErrorPages.jsx";
import Home from "./pages/Home.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Topics from "./pages/Topics.jsx";
import TopicDetail from "./pages/TopicDetail.jsx";
import MP from "./pages/MP.jsx";
import Digest from "./pages/Digest.jsx";
import About from "./pages/About.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Profile from "./pages/Profile.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";

// Admin is no longer a separate mock-password flow — it's the same real
// login as everyone else, gated by user.isAdmin (set server-side; see
// api/README.md — the API's DB is the only place that flag can be granted).
function RequireAdmin({ children }) {
  const { isAuthed, isAdmin } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function App() {
  const { dark, toggle } = useTheme();
  const t = dark ? T.dark : T.light;

  return (
    <ErrorBoundary t={t}>
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.25s" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width:5px; height:5px; }
          ::-webkit-scrollbar-thumb { background:${dark ? "#1E3A5F" : "#CBD5E1"}; border-radius:99px; }
          ::-webkit-scrollbar-track { background:transparent; }
          input::placeholder { color:rgba(255,255,255,0.38); }
          html { scroll-behavior:smooth; }
          a:focus-visible, button:focus-visible, input:focus-visible, [tabindex]:focus-visible {
            outline: 2px solid #38BDF8; outline-offset: 2px;
          }
          @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
          }
        `}</style>
        <TopBar t={t} dark={dark} toggle={toggle} />
        <Routes>
          <Route path="/" element={<Home dark={dark} t={t} />} />
          <Route path="/event/:id" element={<EventDetail dark={dark} t={t} />} />
          <Route path="/search" element={<SearchResults dark={dark} t={t} />} />
          <Route path="/topics" element={<Topics dark={dark} t={t} />} />
          <Route path="/topics/:topic" element={<TopicDetail dark={dark} t={t} />} />
          <Route path="/mps" element={<MP dark={dark} t={t} />} />
          <Route path="/mps/:id" element={<MP dark={dark} t={t} />} />
          <Route path="/digest" element={<Digest dark={dark} t={t} />} />
          <Route path="/about" element={<About t={t} />} />

          <Route path="/login" element={<Login t={t} />} />
          <Route path="/signup" element={<Signup t={t} />} />
          <Route path="/profile" element={<RequireAuth><Profile dark={dark} t={t} /></RequireAuth>} />

          {/* Kept only so a bookmarked link doesn't 404 — see AdminLogin.jsx */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout dark={dark} t={t} /></RequireAdmin>} />

          <Route path="*" element={<NotFound t={t} />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
