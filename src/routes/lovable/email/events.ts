import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

type SuppressionReason = 'unsubscribe' | 'bounce' | 'complaint'

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
        if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Notification-only bookkeeping: Lovable enforces suppression at send time.
        const record = async (
          eventId: string,
          recipient: string,
          reason: SuppressionReason,
          logStatus: string,
          logMessage: string,
        ) => {
          const email = recipient.toLowerCase()

          const { error: suppressError } = await supabase
            .from('suppressed_emails')
            .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
          if (suppressError) {
            console.error('Failed to upsert suppressed email', {
              code: suppressError.code,
              message: suppressError.message,
              event_id: eventId,
            })
            throw new Error('Failed to write suppression')
          }

          const { error: logError } = await supabase.from('email_send_log').insert({
            message_id: null,
            template_name: 'system',
            recipient_email: email,
            status: logStatus,
            error_message: logMessage,
            metadata: null,
          })
          if (logError) {
            console.error('Failed to insert email_send_log', {
              code: logError.code,
              message: logError.message,
              event_id: eventId,
            })
            throw new Error('Failed to write email_send_log')
          }
        }

        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record(
                event.event_id,
                event.data.recipient,
                'bounce',
                'bounced',
                'Email bounced',
              )
            },
            'email.complaint': async (event) => {
              await record(
                event.event_id,
                event.data.recipient,
                'complaint',
                'complained',
                'Spam complaint received',
              )
            },
            'email.unsubscribed': async (event) => {
              await record(
                event.event_id,
                event.data.recipient,
                'unsubscribe',
                'suppressed',
                'Recipient unsubscribed',
              )
            },
          },
        })
        return handler(request)
      },
    },
  },
})
