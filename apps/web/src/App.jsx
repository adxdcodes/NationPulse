import { lazy, Suspense } from "react";
import { PagePreloader } from "./components/LoadingUI.jsx";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme, T } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { TopBar } from "./components/UI.jsx";
import { ErrorBoundary } from "./pages/ErrorPages.jsx";
import NotFound from "./pages/ErrorPages.jsx";
const Home = lazy(() => import("./pages/Home.jsx"));
const EventDetail = lazy(() => import("./pages/EventDetail.jsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.jsx"));
const Topics = lazy(() => import("./pages/Topics.jsx"));
const TopicDetail = lazy(() => import("./pages/TopicDetail.jsx"));
const MP = lazy(() => import("./pages/MP.jsx"));
const Digest = lazy(() => import("./pages/Digest.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.jsx"));

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
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const t = dark ? T.dark : T.light;

  return (
    <ErrorBoundary t={t}>
      <div className="np-app" data-theme={dark ? "dark" : "light"} style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.25s" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width:5px; height:5px; }
          ::-webkit-scrollbar-thumb { background:${dark ? "#1E3A5F" : "#CBD5E1"}; border-radius:99px; }
          ::-webkit-scrollbar-track { background:transparent; }

          html { scroll-behavior:smooth; }

          @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
          }
        `}</style>
        <TopBar t={t} dark={dark} toggle={toggle} />
        <div className={isAdminPage ? "np-route-frame np-route-frame--admin" : "np-route-frame np-route-frame--public"}>
        <Suspense fallback={<PagePreloader t={t} />}><Routes>
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
        </Routes></Suspense>
        </div>
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
