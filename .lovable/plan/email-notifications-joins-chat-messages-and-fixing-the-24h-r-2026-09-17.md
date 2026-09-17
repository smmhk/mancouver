# Email notifications: joins, chat messages, and fixing the 24h reminder

## What's broken today

The 24-hour reminder never reaches anyone. The scheduled task that triggers it has been
rejected every 15 minutes with an "Unauthorized" response since it was set up — the key it
sends no longer matches the key the app expects. Only one reminder has ever been sent
(back in August). This is a credentials mismatch, not a logic bug: the reminder logic itself
(right participants, host included, once per person, Vancouver time) is correct.

## What will be added

**1. "Someone joined your session" email**
Sent to the session creator whenever another player joins — through the app, a shared link,
or the assistant integration. Includes who joined, the court, the date and time, how many
players are now in, and a button to view the session. The creator never gets one for
joining their own session.

**2. "New message in your session chat" email**
Sent to the session creator when another participant posts a chat message. Includes the
sender's name, the message text, the session details, and a button that opens the session
page where the chat lives. No email for the creator's own messages.

Both fire automatically from the database the moment the row is created, so every way of
joining or messaging is covered without touching the existing app screens.

**3. Reminder fix**
Realign the scheduled trigger's key with the app so the 24-hour reminders actually go out,
then confirm a live run returns success instead of Unauthorized.

**4. No duplicates**
- Join: one email per joining player per session, recorded before sending.
- Chat: one email per message, recorded before sending.
- Reminder: the existing one-per-participant record stays as-is.
Each send also carries a unique key so a retry can never produce a second copy.

## Notification preferences

The existing per-user notification settings are respected: `session_joined` controls join
emails, `session_reminder` controls reminders. Chat emails use a new `session_message`
preference defaulting to on, editable later if wanted.

## Technical notes

- New templates `session-joined` and `session-chat-message` in `src/lib/email-templates/`,
  registered in `registry.ts`, sent via the existing `sendTemplateEmail` / `enqueueTemplateEmail`
  path (Lovable-managed delivery, suppression and rate limits handled upstream).
- New public routes `src/routes/api/public/hooks/session-joined.ts` and
  `.../session-chat-message.ts`, each verifying a shared bearer secret before doing anything.
- Postgres `AFTER INSERT` triggers on `session_participants` and `session_messages` call
  those routes with `pg_net`, passing only the row id. No polling, no queue table.
- New `email_notification_sends` table (event type + key, unique) claims each notification
  before sending; the claim is released on transient failure so a retry can succeed.
- A single `notify_hook_secret` vault secret is used by all three hooks, including the
  reminder job, replacing the stale key that causes the current 401s.
