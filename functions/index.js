// --- Cloud Functions for Firebase v2 style (CommonJS) ---
const admin = require('firebase-admin')
const sgMail = require('@sendgrid/mail')
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { setGlobalOptions } = require('firebase-functions/v2')
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore')

// ==== Init Firebase Admin SDK ====
const express = require('express')
const cors = require('cors')

// ---- Init ----
admin.initializeApp()
const db = admin.firestore()
setGlobalOptions({ region: 'australia-southeast1' }) 

// --- Robust date coercion: Firestore Timestamp / { _seconds } / ISO / number 
const toDateAny = (v) => {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()          // Firestore Timestamp
  if (typeof v?._seconds === 'number') return new Date(v._seconds * 1000) // Plain object-like
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// AET formatter
const fmtAET = (d) =>
  d ? d.toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Australia/Melbourne'
      }) : ''

// Env (SendGrid + API Key)
const SG_KEY = process.env.SENDGRID_API_KEY
const SENDER_EMAIL = process.env.SENDER_EMAIL
const SENDER_NAME  = process.env.SENDER_NAME  || 'NutriLife Campus'
const PUBLIC_API_KEY_SECRET = defineSecret('PUBLIC_API_KEY')

if (SG_KEY) sgMail.setApiKey(SG_KEY)

// Helpers
const toICS = (date) => {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
    + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
}
const buildICS = ({ uid, title, start, end, locationName, description }) => {
  const uidLine = `${uid}-${Date.now()}@nutrilife-campus`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NutriLife Campus//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uidLine}`,
    `DTSTAMP:${toICS(Date.now())}`,
    `DTSTART:${toICS(start)}`,
    `DTEND:${toICS(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${locationName || ''}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

// ===== onCreate: decide seat + update status + send email =====
exports.onRegistrationCreate = onDocumentCreated('events/{eventId}/registrations/{uid}', async (event) => {
  const { eventId, uid } = event.params
  const snap = event.data
  if (!snap) return

  const regRef = snap.ref
  const evRef  = db.doc(`events/${eventId}`)

  // 1) transaction: seat decision
  let finalStatus = 'waitlist'
  await db.runTransaction(async (tx) => {
    const [evSnap, regSnap] = await Promise.all([tx.get(evRef), tx.get(regRef)])
    if (!evSnap.exists) throw new Error('Event not found')
    if (!regSnap.exists) throw new Error('Registration missing')

    const ev  = evSnap.data()
    const reg = regSnap.data()
    if (reg.status !== 'pending') { finalStatus = reg.status; return } // idempotent

    const capacity  = Number.isFinite(ev.capacity) ? ev.capacity : 0
    const seatsLeft = Number.isFinite(ev.seatsLeft) ? ev.seatsLeft : capacity

    if (seatsLeft > 0) {
      finalStatus = 'confirmed'
      tx.update(evRef, {
        seatsLeft: seatsLeft - 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    } else {
      finalStatus = 'waitlist'
    }
    tx.update(regRef, { status: finalStatus })
  })

  // 2) email (avoid duplicates)
  const [evDoc, regDoc] = await Promise.all([evRef.get(), regRef.get()])
  if (!evDoc.exists || !regDoc.exists) return
  const ev  = evDoc.data()
  const reg = regDoc.data()
  if (reg.mailedAt) return

  const start = toDateAny(ev.startAt)
  const end   = toDateAny(ev.endAt)
  const ics = buildICS({
    uid,
    title: ev.title,
    start,
    end,
    locationName: ev.location?.name,
    description: ev.description
  })
  const subject = finalStatus === 'confirmed'
    ? `Registration Confirmed: ${ev.title}`
    : `Waitlist Confirmation: ${ev.title}`
  const html = `
    <p>Hi ${reg.name || 'there'},</p>
    <p>Your registration status: <strong>${finalStatus.toUpperCase()}</strong></p>
    <p><strong>${ev.title}</strong><br/>
       ${fmtAET(start)} – ${fmtAET(end)}<br/>
       ${ev.location?.name || ''}</p>
    <p>See attached calendar invite.</p>
    <p>NutriLife Campus</p>`

  if (SG_KEY) {
    await sgMail.send({
      to: reg.email,
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject, html,
      attachments: [{
        filename: `${ev.title}.ics`,
        type: 'text/calendar',
        content: Buffer.from(ics).toString('base64'),
        disposition: 'attachment'
      }]
    })
  } else {
    console.warn('SENDGRID_API_KEY not set; skip emailing.')
  }

  await regRef.update({ mailedAt: admin.firestore.FieldValue.serverTimestamp() })
})

// ===== onDelete: free a seat if previously confirmed =====
exports.onRegistrationDelete = onDocumentDeleted('events/{eventId}/registrations/{uid}', async (event) => {
  const prev = event.data?.data()
  if (!prev || prev.status !== 'confirmed') return
  const { eventId } = event.params
  const evRef = db.doc(`events/${eventId}`)
  await db.runTransaction(async (tx) => {
    const evSnap = await tx.get(evRef)
    if (!evSnap.exists) return
    const seatsLeft = Number.isFinite(evSnap.data().seatsLeft) ? evSnap.data().seatsLeft : 0
    tx.update(evRef, {
      seatsLeft: seatsLeft + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
  })
})

// ===== onCall: bulk reminder to all (or confirmed) registrants =====
exports.sendEventReminder = onCall(
  { region: 'australia-southeast1' },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required.')
      }

      const eventId = request.data?.eventId
      const onlyConfirmed = request.data?.onlyConfirmed ?? true
      if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.')

      const evRef = db.doc(`events/${eventId}`)
      const evSnap = await evRef.get()
      if (!evSnap.exists) throw new HttpsError('not-found', 'Event not found.')
      const ev = { id: evSnap.id, ...evSnap.data() }

      let regsQuery = evRef.collection('registrations')
      if (onlyConfirmed) regsQuery = regsQuery.where('status', '==', 'confirmed')
      const regsSnap = await regsQuery.get()

      const recipients = []
      regsSnap.forEach(doc => {
        const r = doc.data()
        if (r?.email) recipients.push({ email: r.email, name: r.name || r.displayName || 'Participant' })
      })
      console.log('📨 recipients:', recipients.length)

      const start = toDateAny(ev.startAt)
      const end   = toDateAny(ev.endAt)

      if (!SG_KEY) {
        console.warn('SENDGRID_API_KEY not set; skip emailing.')
        return { sent: 0, message: 'SendGrid not configured' }
      }

      const ics = buildICS({
        uid: `bulk-${ev.id}`,
        title: ev.title,
        start,
        end,
        locationName: ev.location?.name || ev.address || '',
        description: ev.description || ''
      })

      const subject = `Reminder: ${ev.title} starts ${fmtAET(start)}`
      const html = `
        <p>Hi,</p>
        <p>This is a friendly reminder that <strong>${ev.title}</strong> is starting soon.</p>
        <p><strong>When:</strong> ${fmtAET(start)} – ${fmtAET(end)}<br/>
           <strong>Where:</strong> ${ev.location?.name || ev.address || 'See event page'}</p>
        <p>Please find the calendar invite attached.</p>
        <p>${SENDER_NAME || 'NutriLife Campus'}</p>
      `

      const msgs = recipients.map(rcp => ({
        to: { email: rcp.email, name: rcp.name },
        from: { email: SENDER_EMAIL, name: SENDER_NAME || 'NutriLife Campus' },
        subject,
        html,
        attachments: [{
          filename: `${ev.title}.ics`,
          type: 'text/calendar',
          content: Buffer.from(ics).toString('base64'),
          disposition: 'attachment'
        }]
      }))

      await sgMail.send(msgs, { batch: true })
      console.log('✅ sent:', recipients.length)
      return { sent: recipients.length, onlyConfirmed }
    } catch (err) {
      console.error('❌ sendEventReminder failed:', err)
      throw new HttpsError('internal', err.message || 'Unknown error')
    }
  }
)

// ===================================================================
// ======================= REST API (Public) =========================
// ===================================================================

// Helpers
const toNumber = (v, def) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
const paginate = (items, limit, page) => {
  const start = (page - 1) * limit
  return items.slice(start, start + limit)
}

// Express app
const app = express()

// CORS setup
const ALLOW_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  // 'https://your-production-domain.com', 
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOW_ORIGINS.includes(origin)) return cb(null, true)
    return cb(new Error('Not allowed by CORS'))
  }
}))
// Simple API Key middleware (optional - only checks if secret is set)
app.use((req, res, next) => {
  try {
    const expected = PUBLIC_API_KEY_SECRET.value()
    const key = req.header('x-api-key')
    // Only enforce if secret is actually configured
    if (expected && key !== expected) {
      return res.status(401).json({ error: 'Unauthorized: invalid API key' })
    }
  } catch (err) {
    // Secret not configured - allow request to proceed
    console.log('PUBLIC_API_KEY not configured, skipping auth check')
  }
  next()
})    


// --------- Endpoint 1: GET /api/events ----------
app.get('/events', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().toLowerCase()
    const limit = Math.min(toNumber(req.query.limit, 10), 50)
    const page = Math.max(toNumber(req.query.page, 1), 1)

    const snap = await db.collection('events').where('status', '==', 'open').get()

    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e =>
        !q ||
        (e.title?.toLowerCase().includes(q)) ||
        (e.category?.toLowerCase?.().includes(q)) ||
        (e.description?.toLowerCase?.().includes(q))
      )
      .sort((a, b) => {
        const sa = toDateAny(a.startAt)?.getTime() ?? 0
        const sb = toDateAny(b.startAt)?.getTime() ?? 0
        return sa - sb
      })
      .map(e => ({
        id: e.id,
        title: e.title,
        category: e.category || e.type || null,
        startAt: toDateAny(e.startAt)?.toISOString() || null,
        endAt: toDateAny(e.endAt)?.toISOString() || null,
        location: e.location || null,
        seatsLeft: e.seatsLeft ?? null,
        tags: Array.isArray(e.tags) ? e.tags : []
      }))

    const data = paginate(all, limit, page)
    res.json({ ok: true, page, limit, total: all.length, data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Internal error' })
  }
})

// --------- Endpoint 2: GET /api/recipes ----------
app.get('/recipes', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().toLowerCase()
    const minProtein = toNumber(req.query.minProtein, 0)
    const tag = (req.query.tag || '').toString().toLowerCase()
    const limit = Math.min(toNumber(req.query.limit, 10), 50)
    const page = Math.max(toNumber(req.query.page, 1), 1)

    const snap = await db.collection('recipes').get()
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r =>
        (r.protein ?? 0) >= minProtein &&
        (!q || r.name?.toLowerCase().includes(q)) &&
        (!tag || (Array.isArray(r.tags) && r.tags.map(t => String(t).toLowerCase()).includes(tag)))
      )
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map(r => ({
        id: r.id,
        name: r.name,
        protein: r.protein ?? null,
        calories: r.calories ?? null,
        ratingAvg: r.ratingAvg ?? r.rating ?? null,
        tags: Array.isArray(r.tags) ? r.tags : []
      }))

    const data = paginate(all, limit, page)
    res.json({ ok: true, page, limit, total: all.length, data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Internal error' })
  }
})

// ----- Export the Express app as a Cloud Function -----
exports.api = onRequest(
  { region: 'australia-southeast1', secrets: [PUBLIC_API_KEY_SECRET] },
  app
)
