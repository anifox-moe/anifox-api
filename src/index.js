import 'dotenv/config'
import cors from 'cors'
import morgan from 'morgan'
import express from 'express'
import api from './api'
import db from './db'
import { errorHandler } from './middleware'
import rateLimit from 'express-rate-limit'
const addRequestId = require('express-request-id')()

const app = express()

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

app.set('trust proxy', 1)

app.use(limiter)

// logger
app.use(morgan('dev'))
app.use(cors())

// Body parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Adds an ID property to the request
app.use(addRequestId)

db.then(db => {
  // Main api route
  app.use('/api', api(db))

  // Error handler middlware
  app.use(errorHandler)

  app.listen(process.env.PORT, () =>
    console.log(`Started on port ${process.env.PORT}`)
  )
})
