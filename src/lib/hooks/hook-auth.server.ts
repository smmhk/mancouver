import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TZ = 'America/Vancouver'
export const SITE_URL = 'https://mancouvertennis.live'

export function serviceClient(): SupabaseClient<any> | null {
  const url = process.env['SUPABASE_URL'] || import.meta.env.VITE_SUPABASE_URL
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Database triggers and cron jobs authenticate with a single-use token they
 * insert into public.hook_tokens right before calling the route. The token is
 * consumed here, so a leaked token cannot be replayed. The service role key is
 * also accepted for manual/admin invocations.
 */
export async function verifyHookRequest(
  request: Request,
  supabase: SupabaseClient<any>,
): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  if (token === process.env['SUPABASE_SERVICE_ROLE_KEY']) return true

  const { data, error } = await supabase
    .from('hook_tokens')
    .delete()
    .eq('token', token)
    .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .select('token')
  if (error) {
    console.error('hook token verification failed', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

/** Claims a one-time notification send. Returns false when already claimed. */
export async function claimNotification(
  supabase: SupabaseClient<any>,
  eventType: string,
  eventKey: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('email_notification_sends')
    .insert({ event_type: eventType, event_key: eventKey })
  return !error
}

export async function releaseNotification(
  supabase: SupabaseClient<any>,
  eventType: string,
  eventKey: string,
): Promise<void> {
  await supabase
    .from('email_notification_sends')
    .delete()
    .eq('event_type', eventType)
    .eq('event_key', eventKey)
}

/** Converts a Vancouver local date + time to the correct UTC instant (DST-safe). */
export function vancouverToUtc(dateStr: string, timeStr: string): Date {
  const [h = '00', m = '00', s = '00'] = timeStr.split(':')
  const naive = new Date(`${dateStr}T${h.padStart(2, '0')}:${m}:${s}Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(naive)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return new Date(naive.getTime() - (asUtc - naive.getTime()))
}

export function formatLabels(dateStr: string, start: string, end: string) {
  const startUtc = vancouverToUtc(dateStr, start)
  const endUtc = vancouverToUtc(dateStr, end)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(startUtc)
  const t = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d)
  return { dateLabel, timeLabel: `${t(startUtc)} – ${t(endUtc)}`, startUtc }
}
