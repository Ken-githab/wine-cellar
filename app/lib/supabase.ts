import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && key);

// 未設定時は空のオブジェクトを型キャスト（全使用箇所で isSupabaseConfigured をガード済み）
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url, key)
  : ({} as SupabaseClient);
