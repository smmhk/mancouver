import { createFileRoute } from '@tanstack/react-router'
import { enqueueTemplateEmail } from '@/lib/email-templates/enqueue.server'
import {
  SITE_URL,
  claimNotification,
  formatLabels,
  releaseNotification,
  serviceClient,
  verifyHookRequest,
} from '@/lib/hooks/hook-auth.server'

export const Route = createFileRoute('/api/public/hooks/session-joined')({
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

        const body = (await request.json().catch(() => ({}))) as {
          session_id?: string
          user_id?: string
        }
        const sessionId = body.session_id
        const joinerId = body.user_id
        if (!sessionId || !joinerId) {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const { data: session } = await supabase
          .from('sessions')
          .select(
            'id, creator_id, session_date, start_time, end_time, max_players, status, court:courts(name, address)',
          )
          .eq('id', sessionId)
          .maybeSingle()

        if (!session || session.status !== 'scheduled') {
          return Response.json({ skipped: 'session_unavailable' })
        }
        if (session.creator_id === joinerId) {
          return Response.json({ skipped: 'self_join' })
        }

        const [{ data: host }, { data: joiner }, { count }, { data: settings }] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('email, display_name')
              .eq('id', session.creator_id)
              .maybeSingle(),
            supabase.from('profiles').select('display_name').eq('id', joinerId).maybeSingle(),
            supabase
              .from('session_participants')
              .select('id', { count: 'exact', head: true })
              .eq('session_id', sessionId),
            supabase
              .from('notification_settings')
              .select('session_joined')
              .eq('user_id', session.creator_id)
              .maybeSingle(),
          ])

        if (!host?.email) return Response.json({ skipped: 'no_host_email' })
        if (settings && settings.session_joined === false) {
          return Response.json({ skipped: 'opted_out' })
        }

        const eventKey = `${sessionId}:${joinerId}`
        if (!(await claimNotification(supabase, 'session-joined', eventKey))) {
          return Response.json({ skipped: 'already_sent' })
        }

        const { dateLabel, timeLabel } = formatLabels(
          session.session_date,
          session.start_time,
          session.end_time,
        )
        const court = (session as any).court as { name?: string; address?: string } | null

        const result = await enqueueTemplateEmail(supabase, {
          templateName: 'session-joined',
          recipientEmail: host.email,
          idempotencyKey: `session-joined:${eventKey}`,
          templateData: {
            hostName: host.display_name || 'there',
            joinerName: joiner?.display_name || 'A player',
            courtName: court?.name ?? 'your court',
            courtAddress: court?.address ?? null,
            dateLabel,
            timeLabel,
            playerCount: count ?? 1,
            maxPlayers: session.max_players,
            sessionUrl: `${SITE_URL}/s/${sessionId}`,
          },
        })

        if (!result.sent && result.reason === 'send_failed') {
          await releaseNotification(supabase, 'session-joined', eventKey)
        }

        return Response.json({ success: true, sent: result.sent })
      },
    },
  },
})
