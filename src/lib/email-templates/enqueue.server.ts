import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from './send-email'

/**
 * Sends a registered template through Lovable's managed email API and records
 * the outcome in email_send_log. Callable from trusted server-side jobs
 * (service-role client required).
 */
export async function enqueueTemplateEmail(
  supabase: SupabaseClient<any>,
  opts: {
    templateName: string
    recipientEmail: string
    templateData: Record<string, any>
    idempotencyKey?: string
  },
): Promise<{ sent: boolean; reason?: string }> {
  const recipient = opts.recipientEmail

  const log = async (status: string, errorMessage?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: opts.templateName,
      recipient_email: recipient,
      status,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
      })
    }
  }

  try {
    const result = await sendTemplateEmail(opts.templateName, recipient, {
      templateData: opts.templateData,
      idempotencyKey: opts.idempotencyKey,
    })

    if (!result.sent) {
      await log('suppressed')
      return { sent: false, reason: 'email_suppressed' }
    }

    await log('sent')
    return { sent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown send failure'
    await log('failed', message)
    return { sent: false, reason: 'send_failed' }
  }
}
