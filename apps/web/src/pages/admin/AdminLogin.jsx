import { Navigate, useLocation } from "react-router-dom";

// Admin auth is no longer a separate mock password — it's the same real
// login as everyone else, gated by user.isAdmin (see App.jsx's
// RequireAdmin). This file exists only so a bookmarked /admin/login link
// still lands somewhere sensible instead of 404ing.
export default function AdminLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location.state?.from || "/admin" }} />;
}
