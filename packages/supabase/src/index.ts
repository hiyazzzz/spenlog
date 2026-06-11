import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js'

export interface CreateClientConfig {
  url: string
  anonKey: string
  options?: SupabaseClientOptions<'public'>
}

export function createClient({ url, anonKey, options }: CreateClientConfig): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      '[Spenlog] Supabase 환경변수가 설정되지 않았어요.\n' +
      'SUPABASE_URL과 SUPABASE_ANON_KEY를 확인해주세요.'
    )
  }

  return createSupabaseClient(url, anonKey, options)
}

export type { SupabaseClient }
