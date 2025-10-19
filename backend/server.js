const express = require('express')
const cors = require('cors')
const app = express()

app.use(express.json())
app.use(cors()) 
app.get('/__health', (req, res) => res.send('ok'))


app.get('/api/events', async (req, res) => {
  res.json({ ok: true, events: [] })
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Not Found' }))

app.listen(process.env.PORT || 8080)
