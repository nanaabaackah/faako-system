const FORM_NAME = 'contact'
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 1
const DEFAULT_NOTIFICATION_TO = 'dev.nanaabaackah@gmail.com'
const DEFAULT_NOTIFICATION_FROM = 'Portfolio Contact <onboarding@resend.dev>'
const DEFAULT_NOTIFICATION_SUBJECT_PREFIX = '[By Nana Contact]'
const MAX_BODY_BYTES = 12 * 1024
const MAX_FIELD_LENGTHS = {
  name: 120,
  email: 254,
  subject: 160,
  message: 5000,
  subjectTag: 80,
  botField: 200,
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const rateLimitBuckets = globalThis.__bynanaContactRateLimitBuckets ?? new Map()

if (!globalThis.__bynanaContactRateLimitBuckets) {
  globalThis.__bynanaContactRateLimitBuckets = rateLimitBuckets
}

const buildBaseHeaders = () => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
})

const createJsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: buildBaseHeaders(),
  body: JSON.stringify(payload),
})

const normalizeOrigin = (value) => {
  if (typeof value !== 'string' || !value.trim()) return ''

  try {
    return new URL(value.trim()).origin
  } catch {
    return ''
  }
}

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const getHeader = (event, name) => {
  if (!event?.headers) return ''
  return String(event.headers[name] || event.headers[name.toLowerCase()] || '').trim()
}

const getRequestOrigin = (event) => {
  const origin = normalizeOrigin(getHeader(event, 'origin'))
  if (origin) return origin

  const referer = getHeader(event, 'referer')
  if (!referer) return ''

  try {
    return new URL(referer).origin
  } catch {
    return ''
  }
}

const getSiteOrigin = (event) => {
  const forwardedProto = getHeader(event, 'x-forwarded-proto') || 'https'
  const forwardedHost = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host')

  if (forwardedHost) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
  }

  const envCandidates = [
    globalThis.process?.env?.CONTACT_FORM_SITE_ORIGIN,
    globalThis.process?.env?.URL,
    globalThis.process?.env?.DEPLOY_PRIME_URL,
    globalThis.process?.env?.DEPLOY_URL,
    globalThis.process?.env?.SITE_URL,
  ]

  for (const candidate of envCandidates) {
    const origin = normalizeOrigin(candidate)
    if (origin) return origin
  }

  return ''
}

const getAllowedOrigins = (event) => {
  const configured = globalThis.process?.env?.CONTACT_ALLOWED_ORIGINS
  if (configured) {
    return configured
      .split(',')
      .map((item) => normalizeOrigin(item))
      .filter(Boolean)
  }

  const siteOrigin = getSiteOrigin(event)
  return siteOrigin ? [siteOrigin] : []
}

const getClientKey = (event) => {
  const candidates = [
    getHeader(event, 'x-nf-client-connection-ip'),
    getHeader(event, 'client-ip'),
    getHeader(event, 'x-forwarded-for'),
    getHeader(event, 'x-real-ip'),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const [first] = candidate.split(',')
    const normalized = first.trim()
    if (normalized) return normalized
  }

  return 'unknown'
}

const readRequestBody = (event) => {
  if (!event?.body) return ''
  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : String(event.body)
}

const cleanField = (value, maxLength) =>
  String(value ?? '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength)

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getNotificationConfig = () => ({
  apiKey: String(globalThis.process?.env?.RESEND_API_KEY || '').trim(),
  to: cleanField(
    globalThis.process?.env?.CONTACT_NOTIFICATION_TO || DEFAULT_NOTIFICATION_TO,
    320
  ),
  from: cleanField(
    globalThis.process?.env?.CONTACT_NOTIFICATION_FROM || DEFAULT_NOTIFICATION_FROM,
    320
  ),
  subjectPrefix: cleanField(
    globalThis.process?.env?.CONTACT_NOTIFICATION_SUBJECT_PREFIX || DEFAULT_NOTIFICATION_SUBJECT_PREFIX,
    120
  ),
})

const buildNotificationText = ({
  name,
  email,
  subject,
  subjectTag,
  message,
  submittedAt,
  requestOrigin,
  siteOrigin,
  clientKey,
}) =>
  [
    'A new portfolio contact form submission was received.',
    '',
    `Submitted at: ${submittedAt}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    `Subject tag: ${subjectTag || 'None'}`,
    `Site origin: ${siteOrigin || 'Unknown'}`,
    `Request origin: ${requestOrigin || 'Unknown'}`,
    `Client IP: ${clientKey || 'Unknown'}`,
    '',
    'Message:',
    message,
  ].join('\n')

const buildNotificationHtml = ({
  name,
  email,
  subject,
  subjectTag,
  message,
  submittedAt,
  requestOrigin,
  siteOrigin,
  clientKey,
}) => {
  const rows = [
    ['Submitted at', submittedAt],
    ['Name', name],
    ['Email', email],
    ['Subject', subject],
    ['Subject tag', subjectTag || 'None'],
    ['Site origin', siteOrigin || 'Unknown'],
    ['Request origin', requestOrigin || 'Unknown'],
    ['Client IP', clientKey || 'Unknown'],
  ]

  const metadataRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;border:1px solid #e2e8f0;">${escapeHtml(
          label
        )}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td></tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 24px 16px;background:#0f172a;color:#f8fafc;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.72;">By Nana</p>
        <h1 style="margin:0;font-size:24px;line-height:1.3;">New contact form submission</h1>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;border-spacing:0;margin:0 0 24px;">
          ${metadataRows}
        </table>
        <h2 style="margin:0 0 12px;font-size:16px;">Message</h2>
        <div style="padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;white-space:pre-wrap;">${escapeHtml(
          message
        )}</div>
      </div>
    </div>
  </body>
</html>`
}

const sendNotificationEmail = async ({
  apiKey,
  to,
  from,
  subjectPrefix,
  name,
  email,
  subject,
  subjectTag,
  message,
  submittedAt,
  requestOrigin,
  siteOrigin,
  clientKey,
}) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${subjectPrefix} ${subject}`.trim(),
      reply_to: email,
      text: buildNotificationText({
        name,
        email,
        subject,
        subjectTag,
        message,
        submittedAt,
        requestOrigin,
        siteOrigin,
        clientKey,
      }),
      html: buildNotificationHtml({
        name,
        email,
        subject,
        subjectTag,
        message,
        submittedAt,
        requestOrigin,
        siteOrigin,
        clientKey,
      }),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    console.error('Contact notification email failed.', {
      status: response.status,
      body: errorBody.slice(0, 600),
    })
    throw new Error('CONTACT_NOTIFICATION_FAILED')
  }
}

const consumeRateLimit = (clientKey) => {
  const now = Date.now()
  const windowMs = parsePositiveInteger(
    globalThis.process?.env?.CONTACT_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS
  )
  const maxRequests = parsePositiveInteger(
    globalThis.process?.env?.CONTACT_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS
  )

  for (const [key, timestamps] of rateLimitBuckets.entries()) {
    const active = timestamps.filter((timestamp) => now - timestamp < windowMs)
    if (active.length) {
      rateLimitBuckets.set(key, active)
    } else {
      rateLimitBuckets.delete(key)
    }
  }

  const active = rateLimitBuckets.get(clientKey) || []
  if (active.length >= maxRequests) {
    const retryAfterMs = Math.max(windowMs - (now - active[0]), 0)
    return {
      limited: true,
      retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
    }
  }

  active.push(now)
  rateLimitBuckets.set(clientKey, active)
  return { limited: false, retryAfterSeconds: 0 }
}

const buildSubmissionUrl = (event) => {
  const configured = globalThis.process?.env?.CONTACT_FORM_SUBMISSION_URL
  if (configured) {
    const siteOrigin = getSiteOrigin(event)
    return siteOrigin ? new URL(configured, siteOrigin).toString() : new URL(configured).toString()
  }

  const siteOrigin = getSiteOrigin(event)
  if (!siteOrigin) return ''
  return new URL('/', siteOrigin).toString()
}

export async function handler(event) {
  const method = String(event?.httpMethod || 'POST').toUpperCase()

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...buildBaseHeaders(),
        Allow: 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (method !== 'POST') {
    return createJsonResponse(405, { error: 'Method not allowed' })
  }

  const requestOrigin = getRequestOrigin(event)
  const allowedOrigins = getAllowedOrigins(event)

  // Contact submissions should only originate from this site, not cross-site callers.
  if (!requestOrigin || !allowedOrigins.length || !allowedOrigins.includes(requestOrigin)) {
    return createJsonResponse(403, { error: 'Forbidden' })
  }

  const rawBody = readRequestBody(event)
  if (!rawBody) {
    return createJsonResponse(400, { error: 'Invalid request body' })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return createJsonResponse(413, { error: 'Request is too large' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return createJsonResponse(400, { error: 'Invalid JSON body' })
  }

  const clientKey = getClientKey(event)
  const rateLimit = consumeRateLimit(clientKey)
  if (rateLimit.limited) {
    return {
      statusCode: 429,
      headers: {
        ...buildBaseHeaders(),
        'Retry-After': String(rateLimit.retryAfterSeconds),
      },
      body: JSON.stringify({
        error: `Please wait ${rateLimit.retryAfterSeconds} seconds before sending another message.`,
      }),
    }
  }

  const botField = cleanField(payload?.botField, MAX_FIELD_LENGTHS.botField)
  if (botField) {
    return createJsonResponse(202, { ok: true })
  }

  const name = cleanField(payload?.name, MAX_FIELD_LENGTHS.name)
  const email = cleanField(payload?.email, MAX_FIELD_LENGTHS.email).toLowerCase()
  const subject = cleanField(payload?.subject, MAX_FIELD_LENGTHS.subject)
  const message = cleanField(payload?.message, MAX_FIELD_LENGTHS.message)
  const subjectTag = cleanField(payload?.subjectTag, MAX_FIELD_LENGTHS.subjectTag)
  const notificationConfig = getNotificationConfig()

  if (!name || !email || !subject || !message) {
    return createJsonResponse(400, { error: 'All fields are required.' })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return createJsonResponse(400, { error: 'A valid email address is required.' })
  }

  if (message.length < 20) {
    return createJsonResponse(400, { error: 'Please provide a little more detail in your message.' })
  }

  if (!notificationConfig.apiKey) {
    console.error('Contact notifications are not configured. Missing RESEND_API_KEY.')
    return createJsonResponse(500, {
      error: 'Contact notifications are not configured right now. Please try again shortly.',
    })
  }

  const submissionUrl = buildSubmissionUrl(event)
  if (!submissionUrl) {
    return createJsonResponse(500, { error: 'Contact form target is not configured.' })
  }

  const formBody = new URLSearchParams({
    'form-name': FORM_NAME,
    name,
    email,
    subject,
    message,
    subjectTag,
    'bot-field': '',
  }).toString()

  try {
    const upstreamResponse = await fetch(submissionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    })

    if (!upstreamResponse.ok) {
      return createJsonResponse(502, {
        error: 'Unable to send your message right now. Please try again shortly.',
      })
    }

    const submittedAt = new Date().toISOString()
    await sendNotificationEmail({
      ...notificationConfig,
      name,
      email,
      subject,
      subjectTag,
      message,
      submittedAt,
      requestOrigin,
      siteOrigin: getSiteOrigin(event),
      clientKey,
    })

    return createJsonResponse(200, { ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTACT_NOTIFICATION_FAILED') {
      return createJsonResponse(502, {
        error: 'Your message was received, but the notification email could not be sent. Please try again shortly.',
      })
    }

    return createJsonResponse(502, {
      error: 'Unable to send your message right now. Please try again shortly.',
    })
  }
}
