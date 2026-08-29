import * as React from 'react'
import { render } from '@react-email/components'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from './registry'

const SITE_NAME = 'mancouver'
const SENDER_DOMAIN = 'notify.mancouvertennis.live'
const FROM_DOMAIN = 'mancouvertennis.live'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Renders a registered template and enqueues it for delivery.
 * Mirrors the logic of the transactional send route, but callable
 * from trusted server-side jobs (service-role client required).
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
  const template = TEMPLATES[opts.templateName]
  if (!template) return { sent: false, reason: 'template_not_found' }

  const recipient = template.to || opts.recipientEmail
  if (!recipient) return { sent: false, reason: 'no_recipient' }

  const normalizedEmail = recipient.toLowerCase()
  const messageId = crypto.randomUUID()

  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressionError) return { sent: false, reason: 'suppression_check_failed' }
  if (suppressed) return { sent: false, reason: 'email_suppressed' }

  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken?.used_at) return { sent: false, reason: 'unsubscribed' }

  if (existingToken) {
    unsubscribeToken = existingToken.token
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: storedToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (!storedToken) return { sent: false, reason: 'token_storage_failed' }
    unsubscribeToken = storedToken.token
  }

  const element = React.createElement(template.component, opts.templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(opts.templateData)
      : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.templateName,
      idempotency_key: opts.idempotencyKey || messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { sent: false, reason: 'enqueue_failed' }
  }

  return { sent: true }
}
