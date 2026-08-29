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

export interface SessionReminderProps {
  displayName: string
  courtName: string
  courtAddress?: string | null
  dateLabel: string
  timeLabel: string
  playerCount: number
  sessionUrl: string
}

export function SessionReminderEmail({
  displayName,
  courtName,
  courtAddress,
  dateLabel,
  timeLabel,
  playerCount,
  sessionUrl,
}: SessionReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Tennis tomorrow at ${courtName} — ${timeLabel}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px', backgroundColor: '#faf8f1', borderRadius: '12px' }}>
          <Text style={{ fontSize: '14px', letterSpacing: '2px', color: '#1f4d2a', margin: '0 0 8px', textTransform: 'uppercase' }}>
            Mancouver
          </Text>
          <Heading style={{ fontSize: '24px', color: '#12281a', margin: '0 0 16px' }}>
            See you on court tomorrow
          </Heading>
          <Text style={{ fontSize: '16px', color: '#33413a', margin: '0 0 20px' }}>
            Hi {displayName}, this is your 24-hour reminder for your upcoming tennis session.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #e3e0d4' }}>
            <Text style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#12281a' }}>{courtName}</Text>
            {courtAddress ? (
              <Text style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7568' }}>{courtAddress}</Text>
            ) : null}
            <Text style={{ margin: '0 0 4px', fontSize: '15px', color: '#33413a' }}>{dateLabel}</Text>
            <Text style={{ margin: '0 0 4px', fontSize: '15px', color: '#33413a' }}>{timeLabel} (Vancouver time)</Text>
            <Text style={{ margin: '0', fontSize: '15px', color: '#33413a' }}>
              {playerCount} {playerCount === 1 ? 'player' : 'players'} confirmed
            </Text>
          </Section>

          <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <Link
              href={sessionUrl}
              style={{
                backgroundColor: '#1f4d2a',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '999px',
                fontSize: '16px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              View session
            </Link>
          </Section>

          <Hr style={{ borderColor: '#e3e0d4', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#8a8f85', margin: 0 }}>
            You're receiving this because you joined this session on Mancouver.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: SessionReminderEmail,
  displayName: 'Session reminder (24h)',
  subject: (data: Record<string, any>) =>
    `Tennis tomorrow at ${data['courtName'] ?? 'your court'} — ${data['timeLabel'] ?? ''}`.trim(),
  previewData: {
    displayName: 'Mandy',
    courtName: 'Stanley Park Tennis Courts',
    courtAddress: 'Beach Ave, Vancouver, BC',
    dateLabel: 'Sunday, August 30',
    timeLabel: '10:00 AM – 11:30 AM',
    playerCount: 4,
    sessionUrl: 'https://mancouvertennis.live/s/00000000-0000-0000-0000-000000000000',
  },
}
