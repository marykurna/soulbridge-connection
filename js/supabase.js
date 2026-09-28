// ============================================================
// SOULBRIDGE CONNECTION — SUPABASE CLIENT
// ============================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://mpvgzapfbyuogomecils.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_zJLXAyP9MnjQS-6Gj0705g_G2LF0Orf";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("✅ Supabase client ready");