// ============================================================
// SOULBRIDGE CONNECTION — AUTH HELPERS
// ============================================================
// Shared auth functions used by login, signup, and dashboard
// pages. Keeps auth logic in one place.
// ============================================================

import { supabase } from "./supabase.js";

/**
 * Get the currently logged-in user (or null if not logged in).
 * Also fetches their profile from the profiles table.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

/**
 * Get the current session (or null if not logged in).
 * Faster than getCurrentUser if you don't need the profile.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Log the current user out and redirect to a page.
 */
export async function logout(redirectTo = "index.html") {
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}

/**
 * Redirect to login if the user is not authenticated.
 * Use this at the top of protected pages (like dashboard).
 */
export async function requireAuth(redirectTo = "login.html") {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}