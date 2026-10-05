// ============================================================
// SOULBRIDGE CONNECTION — ADMIN HELPERS
// ============================================================
// Only users listed in the admin_users table can use these
// functions successfully. RLS policies enforce this too.
// ============================================================

import { supabase } from "./supabase.js";

/**
 * Returns true if the current user is an admin.
 * Calls the `is_admin()` SQL function we created.
 */
export async function checkIsAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("is_admin check failed:", error);
    return false;
  }
  return data === true;
}

/**
 * Redirect non-admins away from admin pages.
 * Call this at the top of every admin page.
 */
export async function requireAdmin(redirectTo = "dashboard.html") {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

/**
 * Fetch all profiles (including phone numbers).
 * Admins can see more fields than regular users.
 */
export async function getAllProfilesForAdmin() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch profiles failed:", error);
    throw error;
  }
  return data || [];
}

/**
 * Get a single profile by id (admin view — includes phone).
 */
export async function getProfileForAdmin(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Fetch profile failed:", error);
    return null;
  }
  return data;
}

/**
 * Create a new member profile (admin only).
 * Returns the created profile row.
 */
export async function createMember(fields) {
  const { data, error } = await supabase
    .from("profiles")
    .insert(fields)
    .select()
    .single();

  if (error) {
    console.error("Create member failed:", error);
    throw error;
  }
  return data;
}

/**
 * Update a member profile (admin only).
 */
export async function updateMember(id, fields) {
  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update member failed:", error);
    throw error;
  }
  return data;
}

/**
 * Delete a member (admin only).
 */
export async function deleteMember(id) {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete member failed:", error);
    throw error;
  }
}

/**
 * Toggle the "verified" badge on a member.
 */
export async function toggleVerified(id, currentValue) {
  return updateMember(id, { verified: !currentValue });
}

/**
 * Fetch all interests (who's interested in whom).
 */
export async function getAllInterests() {
  const { data, error } = await supabase
    .from("interests")
    .select(`
      *,
      from_user:profiles!interests_from_user_id_fkey(id, name, photo_url),
      to_user:profiles!interests_to_user_id_fkey(id, name, photo_url)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch interests failed:", error);
    // Fallback: return interests without joined profile data
    const { data: raw } = await supabase
      .from("interests")
      .select("*")
      .order("created_at", { ascending: false });
    return raw || [];
  }
  return data || [];
}

/**
 * Fetch all payments.
 */
export async function getAllPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch payments failed:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch pending refund requests.
 */
export async function getRefundRequests(status = "pending") {
  let query = supabase
    .from("refund_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("Fetch refunds failed:", error);
    return [];
  }
  return data || [];
}

/**
 * Mark a refund request as processed.
 * Does NOT call Paystack yet — that's a manual step for now.
 */
export async function markRefundProcessed(refundId, adminNote = "") {
  const { data, error } = await supabase
    .from("refund_requests")
    .update({
      status: "processed",
      admin_note: adminNote,
      processed_at: new Date().toISOString()
    })
    .eq("id", refundId)
    .select()
    .single();

  if (error) {
    console.error("Mark refund failed:", error);
    throw error;
  }
  return data;
}

/**
 * Deny a refund request.
 */
export async function denyRefund(refundId, adminNote = "") {
  const { data, error } = await supabase
    .from("refund_requests")
    .update({
      status: "denied",
      admin_note: adminNote,
      processed_at: new Date().toISOString()
    })
    .eq("id", refundId)
    .select()
    .single();

  if (error) {
    console.error("Deny refund failed:", error);
    throw error;
  }
  return data;
}

/**
 * Fetch all notifications (system log).
 */
export async function getAllNotifications(limit = 100) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Fetch notifications failed:", error);
    return [];
  }
  return data || [];
}

/**
 * Upload a photo for a member (admin).
 * Uses the same storage bucket as regular photos.
 */
export async function uploadMemberPhoto(file, memberId) {
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${memberId}/${Date.now()}.${ext}`;

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

  const { data } = supabase.storage
    .from("photos")
    .getPublicUrl(filename);

  return data.publicUrl;
}