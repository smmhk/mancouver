import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { enqueueTemplateEmail } from '@/lib/email-templates/enqueue.server'

const TZ = 'America/Vancouver'
const SITE_URL = 'https://mancouvertennis.live'

/** Converts a Vancouver local date + time to the correct UTC instant (DST-safe). */
function vancouverToUtc(dateStr: string, timeStr: string): Date {
  const [h = '00', m = '00', s = '00'] = timeStr.split(':')
  const naive = new Date(`${dateStr}T${h.padStart(2, '0')}:${m}:${s}Z`)
  // Determine the tz offset at that instant, then correct.
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
  const offset = asUtc - naive.getTime()
  return new Date(naive.getTime() - offset)
}

function formatLabels(dateStr: string, start: string, end: string) {
  const startUtc = vancouverToUtc(dateStr, start)
  const endUtc = vancouverToUtc(dateStr, end)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(startUtc)
  const t = (d: Date) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  return { dateLabel, timeLabel: `${t(startUtc)} – ${t(endUtc)}`, startUtc }
}

export const Route = createFileRoute('/api/public/hooks/session-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = serviceClient()
        if (!supabase) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        if (!(await verifyHookRequest(request, supabase))) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = Date.now()
        const horizon = now + 24 * 60 * 60 * 1000

        // Look at a generous date window; exact instants are filtered below.
        const dayStr = (offsetDays: number) =>
          new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(
            new Date(now + offsetDays * 86400000),
          )

        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select(
            'id, session_date, start_time, end_time, status, court:courts(name, address)',
          )
          .eq('status', 'scheduled')
          .gte('session_date', dayStr(0))
          .lte('session_date', dayStr(2))

        if (sessionsError) {
          console.error('session-reminders: failed to load sessions', sessionsError)
          return Response.json({ error: 'Failed to load sessions' }, { status: 500 })
        }

        let sent = 0
        let skipped = 0

        for (const session of sessions ?? []) {
          const { dateLabel, timeLabel, startUtc } = formatLabels(
            session.session_date,
            session.start_time,
            session.end_time,
          )
          const startMs = startUtc.getTime()
          // Only sessions starting within the next 24 hours (and not already started).
          if (startMs <= now || startMs > horizon) continue

          const { data: participants } = await supabase
            .from('session_participants')
            .select('user_id')
            .eq('session_id', session.id)

          if (!participants?.length) continue
          const playerCount = participants.length

          const userIds = participants.map((p) => p.user_id)

          const [{ data: profiles }, { data: settings }, { data: alreadySent }] =
            await Promise.all([
              supabase.from('profiles').select('id, email, display_name').in('id', userIds),
              supabase
                .from('notification_settings')
                .select('user_id, session_reminder')
                .in('user_id', userIds),
              supabase
                .from('session_reminder_sends')
                .select('user_id')
                .eq('session_id', session.id)
                .eq('reminder_type', '24h'),
            ])

          const sentSet = new Set((alreadySent ?? []).map((r) => r.user_id))
          const optedOut = new Set(
            (settings ?? []).filter((s) => s.session_reminder === false).map((s) => s.user_id),
          )

          const court = (session as any).court as { name?: string; address?: string } | null

          for (const profile of profiles ?? []) {
            if (sentSet.has(profile.id) || optedOut.has(profile.id) || !profile.email) {
              skipped++
              continue
            }

            // Claim the send first — the unique constraint guarantees one email
            // per participant per session even if this job overlaps itself.
            const { error: claimError } = await supabase
              .from('session_reminder_sends')
              .insert({ session_id: session.id, user_id: profile.id, reminder_type: '24h' })

            if (claimError) {
              skipped++
              continue
            }

            const result = await enqueueTemplateEmail(supabase, {
              templateName: 'session-reminder',
              recipientEmail: profile.email,
              idempotencyKey: `session-reminder:24h:${session.id}:${profile.id}`,
              templateData: {
                displayName: profile.display_name || 'there',
                courtName: court?.name ?? 'your court',
                courtAddress: court?.address ?? null,
                dateLabel,
                timeLabel,
                playerCount,
                sessionUrl: `${SITE_URL}/s/${session.id}`,
              },
            })

            if (result.sent) {
              sent++
            } else {
              skipped++
              // Release the claim so a later run can retry transient failures.
              if (result.reason !== 'email_suppressed' && result.reason !== 'unsubscribed') {
                await supabase
                  .from('session_reminder_sends')
                  .delete()
                  .eq('session_id', session.id)
                  .eq('user_id', profile.id)
                  .eq('reminder_type', '24h')
              }
            }
          }
        }

        return Response.json({ success: true, sent, skipped })
      },
    },
  },
})
