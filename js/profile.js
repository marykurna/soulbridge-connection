// ============================================================
// SOULBRIDGE CONNECTION — PROFILE HELPERS
// ============================================================
// Functions for loading, saving, and uploading profile data.
// ============================================================

import { supabase } from "./supabase.js";

/**
 * Load the currently logged-in user's profile row.
 * Returns { user, profile } or null if not authenticated.
 */
export async function getMyProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile load error:", profileError);
    return { user, profile: null };
  }

  return { user, profile };
}

/**
 * Load any profile by its row id (uuid).
 */
export async function getProfileById(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Profile fetch error:", error);
    return null;
  }
  return data;
}

/**
 * Load a profile by its slug (e.g. "sam-28").
 */
export async function getProfileBySlug(slug) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return null;
  return data;
}

/**
 * Fetch all profiles (for the members browse page).
 * Basic listing, ordered by newest first.
 */
export async function getAllProfiles(limit = 50) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Members fetch error:", error);
    return [];
  }
  return data || [];
}

/**
 * Save profile updates for the current user.
 * Accepts an object of fields to update.
 */
export async function updateMyProfile(fields) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  // Auto-generate slug if name or age is being set and no slug exists
  const updates = { ...fields };

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Update error:", error);
    throw error;
  }
  return data;
}

/**
 * Convert "Sam Smith" + 28 → "sam-smith-28"
 */
export function slugify(name, age) {
  let slug = String(name || "member")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  if (age) slug = `${slug}-${age}`;
  return slug || "member";
}

/**
 * Upload a photo file to Supabase Storage.
 * Returns the public URL of the uploaded photo.
 */
export async function uploadProfilePhoto(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  // Create a unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${user.id}/${Date.now()}.${ext}`;

  // Upload to the "photos" bucket we created
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage
    .from("photos")
    .getPublicUrl(filename);

  return data.publicUrl;
}