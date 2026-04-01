import { createClient } from '@supabase/supabase-js'

// ShadowCTX public Supabase credentials (safe to bundle — anon key only)
const SHADOWCTX_SUPABASE_URL = 'https://wrqbwyyntobqygjmnmtx.supabase.co'
const SHADOWCTX_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndycWJ3eXludG9icXlnam1ubXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDM3OTgsImV4cCI6MjA5MDQ3OTc5OH0.3FrVNvFz4F-uK1r9sJ57cT-A8YUUBlygf0VdEeYHWMU'

export interface CloudAuthResult {
  accessToken: string
  refreshToken: string
  userId: string
}

function getClient() {
  return createClient(SHADOWCTX_SUPABASE_URL, SHADOWCTX_SUPABASE_ANON_KEY)
}

/**
 * Send a magic-link OTP to the given email address.
 * After calling this, the user should check their email.
 */
export async function cloudSignup(email: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) throw new Error(`Magic link failed: ${error.message}`)
}

/**
 * Sign in with email + password. Returns tokens on success.
 */
export async function cloudLogin(
  email: string,
  password: string,
): Promise<CloudAuthResult> {
  const supabase = getClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Login failed: ${error?.message ?? 'no session returned'}`)
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
  }
}
