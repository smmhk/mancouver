import type { ComponentType } from 'react'
import { template as sessionReminderTemplate } from './session-reminder'
import { template as sessionJoinedTemplate } from './session-joined'
import { template as sessionChatMessageTemplate } from './session-chat-message'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'session-reminder': sessionReminderTemplate,
  'session-joined': sessionJoinedTemplate,
  'session-chat-message': sessionChatMessageTemplate,
}
