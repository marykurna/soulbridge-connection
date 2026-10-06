// ============================================================
// SOULBRIDGE CONNECTION — INTEREST HELPERS
// ============================================================
// Interest = "I want to connect with this member."
// One interest per (from_user, to_user) pair.
// ============================================================

import { supabase } from "./supabase.js";

/**
 * Send an interest from the current user to another user.
 * Returns the created row.
 */
export async function sendInterest(toUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("interests")
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: "pending"
    })
    .select()
    .single();

  if (error) {
    // Duplicate? Already sent? Return existing.
    if (error.code === "23505") {
      throw new Error("You've already sent an interest to this member.");
    }
    console.error("sendInterest error:", error);
    throw error;
  }
  return data;
}

/**
 * Check if the current user has already sent an interest to target user.
 */
export async function hasSentInterest(toUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("interests")
    .select("id, status")
    .eq("from_user_id", user.id)
    .eq("to_user_id", toUserId)
    .maybeSingle();

  if (error) return null;
  return data; // null if not sent, or { id, status }
}

/**
 * Get all interests received by the current user.
 * Joins sender's profile info.
 */
export async function getInterestsReceived() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: interests, error } = await supabase
    .from("interests")
    .select("*")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !interests) return [];

  // Fetch sender profiles
  const senderIds = interests.map(i => i.from_user_id);
  if (senderIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, age, location, photo_url, slug, bio")
    .in("id", senderIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  return interests.map(i => ({
    ...i,
    from_profile: profileMap[i.from_user_id] || null
  }));
}

/**
 * Get all interests sent by the current user.
 */
export async function getInterestsSent() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: interests, error } = await supabase
    .from("interests")
    .select("*")
    .eq("from_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !interests) return [];

  const targetIds = interests.map(i => i.to_user_id);
  if (targetIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, age, location, photo_url, slug, bio")
    .in("id", targetIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  return interests.map(i => ({
    ...i,
    to_profile: profileMap[i.to_user_id] || null
  }));
}

/**
 * Mark interest as "matched" — user accepts someone's interest.
 */
export async function acceptInterest(interestId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("interests")
    .update({ status: "matched" })
    .eq("id", interestId)
    .eq("to_user_id", user.id)  // ensure current user is the recipient
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Decline an interest (only the recipient can).
 */
export async function declineInterest(interestId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("interests")
    .update({ status: "declined" })
    .eq("id", interestId)
    .eq("to_user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Count unread notifications for the current user.
 * (Used on dashboard to show a badge.)
 */
export async function getUnreadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return 0;
  return count || 0;
}