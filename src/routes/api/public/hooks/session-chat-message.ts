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

export const Route = createFileRoute('/api/public/hooks/session-chat-message')({
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

        const body = (await request.json().catch(() => ({}))) as { message_id?: string }
        const messageId = body.message_id
        if (!messageId) return Response.json({ error: 'Invalid payload' }, { status: 400 })

        const { data: message } = await supabase
          .from('session_messages')
          .select('id, session_id, user_id, content')
          .eq('id', messageId)
          .maybeSingle()
        if (!message) return Response.json({ skipped: 'message_missing' })

        const { data: session } = await supabase
          .from('sessions')
          .select('id, creator_id, session_date, start_time, end_time, status, court:courts(name)')
          .eq('id', message.session_id)
          .maybeSingle()

        if (!session || session.status !== 'scheduled') {
          return Response.json({ skipped: 'session_unavailable' })
        }
        if (session.creator_id === message.user_id) {
          return Response.json({ skipped: 'own_message' })
        }

        const [{ data: host }, { data: sender }, { data: settings }] = await Promise.all([
          supabase
            .from('profiles')
            .select('email, display_name')
            .eq('id', session.creator_id)
            .maybeSingle(),
          supabase.from('profiles').select('display_name').eq('id', message.user_id).maybeSingle(),
          supabase
            .from('notification_settings')
            .select('session_message')
            .eq('user_id', session.creator_id)
            .maybeSingle(),
        ])

        if (!host?.email) return Response.json({ skipped: 'no_host_email' })
        if (settings && (settings as any).session_message === false) {
          return Response.json({ skipped: 'opted_out' })
        }

        if (!(await claimNotification(supabase, 'session-chat-message', messageId))) {
          return Response.json({ skipped: 'already_sent' })
        }

        const { dateLabel, timeLabel } = formatLabels(
          session.session_date,
          session.start_time,
          session.end_time,
        )
        const court = (session as any).court as { name?: string } | null

        const result = await enqueueTemplateEmail(supabase, {
          templateName: 'session-chat-message',
          recipientEmail: host.email,
          idempotencyKey: `session-chat-message:${messageId}`,
          templateData: {
            hostName: host.display_name || 'there',
            senderName: sender?.display_name || 'A player',
            messageContent: message.content,
            courtName: court?.name ?? 'your court',
            dateLabel,
            timeLabel,
            sessionUrl: `${SITE_URL}/s/${session.id}`,
          },
        })

        if (!result.sent && result.reason === 'send_failed') {
          await releaseNotification(supabase, 'session-chat-message', messageId)
        }

        return Response.json({ success: true, sent: result.sent })
      },
    },
  },
})
