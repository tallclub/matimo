---
name: twilio
description: "Complete guide to all Twilio tools — text, media, delivery tracking, E.164 formatting, and message management."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Communication"
  difficulty: "beginner"
  apply-to: "twilio-send-sms twilio-send-mms twilio-get-message twilio-list-messages"
  tags: "twilio,sms,mms,messaging,communication"
---

# Twilio

This skill teaches you how to **send, track, and manage** SMS and MMS messages using the Twilio Programmable Messaging API through Matimo tools.

## Tools You Will Use

| Tool | Purpose |
|------|---------|
| `twilio-send-sms` | Send a text message |
| `twilio-send-mms` | Send a message with media attachments |
| `twilio-get-message` | Check message status by SID |
| `twilio-list-messages` | List sent/received messages |

---

## Sending an SMS

Use `twilio-send-sms` to send a text message to any phone number.

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_sid` | string | Twilio Account SID (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) |
| `to` | string | Recipient phone number in E.164 format (e.g., `+15558675310`) |
| `from` | string | Your Twilio phone number in E.164 format (e.g., `+15557122661`) |
| `body` | string | Message text (up to 1,600 characters) |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status_callback` | string | URL to receive delivery status webhooks |

### Best Practices

1. **Always use E.164 format** for phone numbers: `+` followed by country code and number (e.g., `+14155551234`). No spaces, dashes, or parentheses.
2. **Keep SMS under 160 characters** for single-segment delivery. Messages over 160 GSM-7 characters are split into segments and each is billed separately.
3. **Include opt-out language** for marketing: "Reply STOP to unsubscribe" — required by carrier regulations.
4. **Use `status_callback`** for critical messages to track delivery confirmation.
5. **Never send to unverified numbers** on trial accounts — Twilio trial restricts to verified numbers only.

### E.164 Phone Number Format

| Country | Example |
|---------|---------|
| US/Canada | `+14155551234` |
| UK | `+447911123456` |
| Australia | `+61412345678` |
| India | `+919876543210` |

### Example: Simple SMS

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "to": "+15558675310",
  "from": "+15557122661",
  "body": "Your appointment is confirmed for tomorrow at 2pm. Reply YES to confirm or CANCEL to reschedule."
}
```

### Example: SMS with Delivery Tracking

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "to": "+15558675310",
  "from": "+15557122661",
  "body": "Your verification code is 847291. This code expires in 10 minutes.",
  "status_callback": "https://api.example.com/webhooks/twilio/status"
}
```

### Understanding the Response

A successful send returns a Message resource:

```json
{
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "queued",
  "to": "+15558675310",
  "from": "+15557122661",
  "body": "Your appointment is confirmed...",
  "num_segments": "1",
  "direction": "outbound-api"
}
```

**Message status flow:** `queued` → `sending` → `sent` → `delivered` (or `failed`/`undelivered`)

---

## Sending an MMS

Use `twilio-send-mms` to send a message with media (images, PDFs, GIFs, etc.).

### Additional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `media_url` | string | Publicly accessible URL of the media to attach |

### Media Guidelines

- **Supported formats:** JPEG, PNG, GIF, PDF, MP4 (up to 5MB each)
- **URL must be publicly accessible** — Twilio fetches the media from the URL
- **MMS only works** for US/Canada numbers. International numbers fall back to SMS with a link.

### Example: Send Image via MMS

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "to": "+15558675310",
  "from": "+15557122661",
  "body": "Here's the receipt for your order #1234",
  "media_url": "https://cdn.example.com/receipts/1234.png"
}
```

---

## Checking Message Status

Use `twilio-get-message` to check the delivery status of a previously sent message.

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_sid` | string | Your Twilio Account SID |
| `message_sid` | string | The SID returned when the message was sent (e.g., `SMxxx`) |

### Message Status Values

| Status | Meaning |
|--------|---------|
| `queued` | Message is waiting to be sent |
| `sending` | Twilio is sending the message to the carrier |
| `sent` | Message was sent to the carrier successfully |
| `delivered` | Carrier confirmed delivery to the recipient |
| `failed` | Message could not be sent (check `error_code`) |
| `undelivered` | Carrier rejected the message (check `error_code`) |

### Example: Check Delivery Status

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## Listing Messages

Use `twilio-list-messages` to retrieve sent and received messages.

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_sid` | string | Your Twilio Account SID |
| `to` | string | Filter by recipient number |
| `from` | string | Filter by sender number |
| `date_sent` | string | Filter by date (YYYY-MM-DD) |
| `page_size` | number | Results per page (max 1000) |

### Example: List Recent Messages

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "page_size": 20
}
```

---

## Common Workflows

### Workflow: OTP Verification

1. Generate a random code (server-side)
2. Send via `twilio-send-sms` with a short expiry message
3. Track delivery via `twilio-get-message` to confirm receipt
4. If `failed`/`undelivered`, retry or offer alternate channel

### Workflow: Appointment Reminders

1. List upcoming appointments from your system
2. For each, send `twilio-send-sms` with appointment details
3. Include confirmation/cancellation reply instructions
4. Use `twilio-list-messages` to check for incoming replies

### Workflow: Send with Delivery Confirmation

1. Send message with `status_callback` URL
2. Immediately returns `queued` status with SID
3. Poll `twilio-get-message` with the SID if not using webhooks
4. Check for `delivered` status before proceeding

---

## Error Handling

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `21211` | Invalid To number | Verify E.164 format |
| `21212` | Invalid From number | Use a Twilio number from your account |
| `21610` | Recipient opted out | Recipient sent STOP — cannot message them |
| `21614` | To number not valid mobile | Cannot send SMS to landlines |
| `30003` | Unreachable | Phone is off or out of range — retry later |
| `30004` | Message blocked | Carrier filtered the message — review content |
| `30005` | Unknown destination | Number doesn't exist |
| `30006` | Landline or unreachable | Try a different channel |

### Rate Limits

- **Default:** 1 message/second per From number
- **Short codes:** Up to 100 messages/second
- **Toll-free:** Up to 3 messages/second

For high-volume sending, use multiple From numbers or a Messaging Service.

---

## Authentication

Twilio tools use **HTTP Basic Auth**:

- **Username env var:** `TWILIO_ACCOUNT_SID`
- **Password env var:** `TWILIO_AUTH_TOKEN`

Both are found on the [Twilio Console dashboard](https://console.twilio.com). Never share or log your Auth Token.
