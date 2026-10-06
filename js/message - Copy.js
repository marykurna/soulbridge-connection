// ============================================================
// SOULBRIDGE CONNECTION — MESSAGE HELPERS
// ============================================================
// Enforces:
//   - 1 free message per user (then paywall)
//   - Salutation-only content (no phone/email/URLs/etc.)
// ============================================================

import { supabase } from "./supabase.js";

// -------- Blocked patterns --------
// If a message matches any of these, it's rejected.
const BLOCKED_PATTERNS = [
  // Phone numbers (various formats)
  /(?:\+?\d[\d\s\-().]{7,}\d)/,
  /\b0\d{9,10}\b/,                                 // 07XXXXXXXX Kenya
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,             // US-style
  // Emails
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  // URLs
  /(?:https?:\/\/|www\.)[^\s]+/i,
  // Social handles
  /\b(?:whatsapp|wa\.me|telegram|instagram|snapchat|facebook|tiktok|skype|signal)\b/i,
  /\b(?:@[a-zA-Z0-9._]{3,})\b/,                    // @username
  // "Reach me at" style phrases
  /\b(?:reach me|call me|text me|dm me|hit me up|contact me|find me on)\b/i,
  // Digits spelled out
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b.*\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/i
];

// -------- Allowed salutations --------
// The message must contain one of these and no forbidden content.
const ALLOWED_SALUTATIONS = [
  "hi", "hello", "hey", "heya", "hiya",
  "good morning", "good afternoon", "good evening", "good day",
  "greetings", "howdy", "salutations",
  "nice to meet you", "pleased to meet you",
  "how are you", "how're you", "how are you doing",
  "hi there", "hello there", "hey there",
  "hope you're well", "hope you are well",
  "what's up", "whats up", "sup",
  "morning", "evening", "afternoon"
];

/**
 * Check if a message passes validation.
 * Returns { valid: true } or { valid: false, reason: "..." }
 */
export function validateMessage(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return { valid: false, reason: "Message cannot be empty." };
  }

  if (trimmed.length > 200) {
    return { valid: false, reason: "Message must be under 200 characters." };
  }

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: "Personal contact info is not allowed. Please keep it to a greeting."
      };
    }
  }

  // Check the message contains an allowed salutation
  const lower = trimmed.toLowerCase();
  const hasSalutation = ALLOWED_SALUTATIONS.some(s => lower.includes(s));

  if (!hasSalutation) {
    return {
      valid: false,
      reason: "Please stick to a simple greeting like 'Hi' or 'Hello'."
    };
  }

  return { valid: true };
}

/**
 * Count how many FREE messages the current user has sent.
 */
export async function getFreeMessagesUsed() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", user.id)
    .eq("is_free", true);

  if (error) return 0;
  return count || 0;
}

/**
 * Check whether the current user has any free messages left.
 */
export async function hasFreeMessageLeft() {
  const used = await getFreeMessagesUsed();
  return used < 1; // 1 free message per user total
}

/**
 * Send a message. Validates content and enforces the free-message limit.
 * Returns the created message row.
 */
export async function sendMessage(toUserId, text) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  // 1. Validate content
  const check = validateMessage(text);
  if (!check.valid) {
    throw new Error(check.reason);
  }

  // 2. Check free message allowance
  const freeLeft = await hasFreeMessageLeft();

  if (!freeLeft) {
    // User has used their 1 free message — they need to pay to send more
    throw new Error(
      "You've used your free message. Top up to continue the conversation."
    );
  }

  // 3. Insert the message
  const { data, error } = await supabase
    .from("messages")
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      content: text.trim(),
      is_free: true
    })
    .select()
    .single();

  if (error) {
    console.error("sendMessage error:", error);
    throw error;
  }
  return data;
}

/**
 * Get all messages between two users (both directions).
 */
export async function getConversation(withUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getConversation error:", error);
    return [];
  }
  return data || [];
}

/**
 * Real-time subscription for new messages in a conversation.
 * Calls the callback with the new message row when one arrives.
 * Returns an unsubscribe function.
 */
export function subscribeToConversation(withUserId, callback) {
  const channel = supabase
    .channel(`chat-${withUserId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const m = payload.new;
        if (
          (m.from_user_id === withUserId || m.to_user_id === withUserId)
        ) {
          callback(m);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Get the current user's auth user id.
 * Convenience helper for chat pages.
 */
export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.id : null;
}