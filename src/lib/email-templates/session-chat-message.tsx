import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface SessionChatMessageProps {
  hostName: string
  senderName: string
  messageContent: string
  courtName: string
  dateLabel: string
  timeLabel: string
  sessionUrl: string
}

export function SessionChatMessageEmail({
  hostName,
  senderName,
  messageContent,
  courtName,
  dateLabel,
  timeLabel,
  sessionUrl,
}: SessionChatMessageProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${senderName} posted in your session chat`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px', backgroundColor: '#f4f7fc', borderRadius: '12px' }}>
          <Text style={{ fontSize: '14px', letterSpacing: '2px', color: '#0b2a5b', margin: '0 0 8px', textTransform: 'uppercase' }}>
            Mancouver
          </Text>
          <Heading style={{ fontSize: '24px', color: '#0b1b33', margin: '0 0 16px' }}>
            New message from {senderName}
          </Heading>
          <Text style={{ fontSize: '16px', color: '#33413a', margin: '0 0 20px' }}>
            Hi {hostName}, there's a new message in the chat for your session at {courtName} on {dateLabel}, {timeLabel}.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #dce3ef' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#0b1b33' }}>{senderName}</Text>
            <Text style={{ margin: 0, fontSize: '15px', color: '#33413a', whiteSpace: 'pre-wrap' }}>
              {messageContent}
            </Text>
          </Section>

          <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <Link
              href={sessionUrl}
              style={{
                backgroundColor: '#0b2a5b',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '999px',
                fontSize: '16px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Open session chat
            </Link>
          </Section>

          <Hr style={{ borderColor: '#dce3ef', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#8a8f85', margin: 0 }}>
            You're receiving this because you created this session on Mancouver.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: SessionChatMessageEmail,
  displayName: 'New session chat message',
  subject: (data: Record<string, any>) =>
    `${data['senderName'] ?? 'A player'} posted in your session chat`,
  previewData: {
    hostName: 'Mandy',
    senderName: 'Jessica',
    messageContent: "I'll be at court 3, bringing new balls!",
    courtName: 'Stanley Park Tennis Courts',
    dateLabel: 'Saturday, September 19',
    timeLabel: '2:00 PM – 3:30 PM',
    sessionUrl: 'https://mancouvertennis.live/s/00000000-0000-0000-0000-000000000000',
  },
}
