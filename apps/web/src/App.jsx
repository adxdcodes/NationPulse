import { lazy, Suspense } from "react";
import { PagePreloader } from "./components/LoadingUI.jsx";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider, useTheme, T, FONT_UI } from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { TopBar } from "./components/UI.jsx";
import { ErrorBoundary } from "./pages/ErrorPages.jsx";
import NotFound from "./pages/ErrorPages.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Landing = lazy(() => import("./pages/Landing.jsx"));
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

function RequireAdmin({ children }) {
  const { isAuthed, isAdmin } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function GuestOnly({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  const from = location.state?.from || "/bills";
  if (isAuthed) return <Navigate to={from} replace />;
  return children;
}

function LegacyBillRedirect() {
  const { id } = useParams();
  return <Navigate to={`/bills/${id}`} replace />;
}

function App() {
  const { dark, toggle } = useTheme();
  const { isAuthed } = useAuth();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
  const t = dark ? T.dark : T.light;

  return (
    <ErrorBoundary t={t}>
      <div
        className="np-app"
        data-theme={dark ? "dark" : "light"}
        style={{
          minHeight: "100vh",
          background: t.bg,
          fontFamily: FONT_UI,
          transition: "background 0.2s ease, color 0.2s ease",
        }}
      >
        {isAuthed && !isAuthPage && location.pathname !== "/" && <TopBar t={t} dark={dark} toggle={toggle} />}
        <div key={location.pathname} className={isAdminPage ? "np-route-frame np-route-frame--admin" : "np-route-frame np-route-frame--public"}>
          <Suspense fallback={<PagePreloader path={location.pathname} />}>
            <Routes>
              {/* Guest authentication routes */}
              <Route path="/login" element={<GuestOnly><Login t={t} dark={dark} toggleTheme={toggle} /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><Signup t={t} dark={dark} toggleTheme={toggle} /></GuestOnly>} />

              {/* The public landing page explains the service before sign-in. */}
              <Route path="/" element={<Landing dark={dark} t={t} />} />
              {/* Protected platform routes */}
              <Route path="/bills" element={<RequireAuth><Home dark={dark} t={t} /></RequireAuth>} />
              <Route path="/bills/:id" element={<RequireAuth><EventDetail dark={dark} t={t} /></RequireAuth>} />
              <Route path="/event/:id" element={<RequireAuth><LegacyBillRedirect /></RequireAuth>} />
              <Route path="/search" element={<RequireAuth><SearchResults dark={dark} t={t} /></RequireAuth>} />
              <Route path="/topics" element={<RequireAuth><Topics dark={dark} t={t} /></RequireAuth>} />
              <Route path="/topics/:topic" element={<RequireAuth><TopicDetail dark={dark} t={t} /></RequireAuth>} />
              <Route path="/mps" element={<RequireAuth><MP dark={dark} t={t} /></RequireAuth>} />
              <Route path="/mps/:id" element={<RequireAuth><MP dark={dark} t={t} /></RequireAuth>} />
              <Route path="/digest" element={<RequireAuth><Digest dark={dark} t={t} /></RequireAuth>} />
              <Route path="/about" element={<RequireAuth><About t={t} /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile dark={dark} t={t} /></RequireAuth>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<RequireAdmin><AdminLayout dark={dark} t={t} /></RequireAdmin>} />

              <Route path="*" element={<RequireAuth><NotFound t={t} /></RequireAuth>} />
            </Routes>
          </Suspense>
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
