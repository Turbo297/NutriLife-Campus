// --- Cloud Functions for Firebase v2 style ---
const admin = require('firebase-admin')
const sgMail = require('@sendgrid/mail')

// v2 imports
const { setGlobalOptions } = require('firebase-functions/v2')
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore')

// ---- Init ----
admin.initializeApp()
const db = admin.firestore()
setGlobalOptions({ region: 'australia-southeast1' })   // 统一区域

// Env
const SG_KEY = process.env.SENDGRID_API_KEY
const SENDER_EMAIL = process.env.SENDER_EMAIL
const SENDER_NAME  = process.env.SENDER_NAME  || 'NutriLife Campus'
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

  const start = ev.startAt.toDate()
  const end   = ev.endAt.toDate()
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
       ${start.toLocaleString()} – ${end.toLocaleTimeString()}<br/>
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
