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

export interface SessionJoinedProps {
  hostName: string
  joinerName: string
  courtName: string
  courtAddress?: string | null
  dateLabel: string
  timeLabel: string
  playerCount: number
  maxPlayers: number
  sessionUrl: string
}

export function SessionJoinedEmail({
  hostName,
  joinerName,
  courtName,
  courtAddress,
  dateLabel,
  timeLabel,
  playerCount,
  maxPlayers,
  sessionUrl,
}: SessionJoinedProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${joinerName} joined your tennis session on ${dateLabel}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px', backgroundColor: '#f4f7fc', borderRadius: '12px' }}>
          <Text style={{ fontSize: '14px', letterSpacing: '2px', color: '#0b2a5b', margin: '0 0 8px', textTransform: 'uppercase' }}>
            Mancouver
          </Text>
          <Heading style={{ fontSize: '24px', color: '#0b1b33', margin: '0 0 16px' }}>
            {joinerName} is in
          </Heading>
          <Text style={{ fontSize: '16px', color: '#33413a', margin: '0 0 20px' }}>
            Hi {hostName}, {joinerName} joined your tennis session at {courtName} on {dateLabel} at {timeLabel}.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #dce3ef' }}>
            <Text style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#0b1b33' }}>{courtName}</Text>
            {courtAddress ? (
              <Text style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7568' }}>{courtAddress}</Text>
            ) : null}
            <Text style={{ margin: '0 0 4px', fontSize: '15px', color: '#33413a' }}>{dateLabel}</Text>
            <Text style={{ margin: '0 0 4px', fontSize: '15px', color: '#33413a' }}>{timeLabel} (Vancouver time)</Text>
            <Text style={{ margin: '0', fontSize: '15px', color: '#33413a' }}>
              {playerCount} of {maxPlayers} players confirmed
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
              View session
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
  component: SessionJoinedEmail,
  displayName: 'Player joined your session',
  subject: (data: Record<string, any>) =>
    `${data['joinerName'] ?? 'A player'} joined your tennis session`,
  previewData: {
    hostName: 'Mandy',
    joinerName: 'Jessica',
    courtName: 'Stanley Park Tennis Courts',
    courtAddress: 'Beach Ave, Vancouver, BC',
    dateLabel: 'Saturday, September 19',
    timeLabel: '2:00 PM – 3:30 PM',
    playerCount: 2,
    maxPlayers: 4,
    sessionUrl: 'https://mancouvertennis.live/s/00000000-0000-0000-0000-000000000000',
  },
}
