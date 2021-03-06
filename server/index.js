/* eslint-disable no-console */
import * as express from "express"
import * as helmet from 'helmet'
import * as compression from 'compression'
import * as expressSession from "express-session"
import { createConnection } from 'typeorm'
import { TypeormStore } from 'connect-typeorm'
import * as passport from "passport"
import * as path from "path"

import Session from './logic/auth/session'
import { generateConnectionOptions } from './utils'

const ENV = process.env.NODE_ENV
const SECRET = process.env.SESSION_SECRET || `a perhaps worst-practices secret`
const PORT = process.env.PORT || 1337

const boot = async () => {
  try {
    const connection = await createConnection(generateConnectionOptions())
    console.log(`Connected to the database`)

    const api = require(`./api`)
    const { userRepository } = require(`./db/repositories`)
    const sessionRepository = connection.getRepository(Session)

    const app = express()

    // Body parsing middleware
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    // Security
    // its csp interferes with webpack-dev-server, which we need in dev mode
    // don't ask how I know, but lets just say it cost ~12 hours of my life
    if (ENV === `production`) app.use(helmet())

    // Compress responses
    app.use(compression())

    // Logging middleware for development environment
    if (ENV !== `production` && ENV !== `test`) app.use(require(`volleyball`))

    app.use(expressSession({
      cookie: {
        maxAge: 60 * 60 * 24 * 7 * 1000, // 1 week
        secure: ENV !== `test`, // secure cookies interfere with superagent
        httpOnly: true,
      },
      resave: false,
      saveUninitialized: false,
      secret: SECRET,
      name: `sessionId`,
      store: new TypeormStore({
        cleanupLimit: 0, // default
        limitSubquery: true, // default
        ttl: undefined, // defaults to session.maxAge according to connect-typeorm's docs (presumably actually session.cookie.maxAge; express-session's docs don't mention a session.maxAge property)
      }).connect(sessionRepository),
    }))
    passport.serializeUser((user, done) => { done(null, user.id) })
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await userRepository.getById(id)
        done(null, user)
      } catch (err) {
        done(err)
      }
    })
    app.use(passport.initialize())
    app.use(passport.session())

    // Static file serving middleware
    app.use(express.static(path.join(__dirname, `../dist`)))
    app.use(express.static(path.join(__dirname, `../public`)))

    // Sub-routers
    app.use(`/api`, api)

    // All other requests
    app.get(`*`, (req, res) => {
      res.sendFile(path.join(__dirname, `../dist/index.html`))
    })

    // 404 response
    app.use((req, res, next) => {
      const err = new Error(`Page not found`)
      err.status = 404
      next(err)
    })

    // Error handling endware
    app.use((err, req, res, next) => {
      if (ENV !== `test`) {
        console.error(err)
      }
      // needs actual handling for different types of errors, both code and message
      // things that are nexted by async functions should get their code and message assigned by type of failure
      // errors that are manually created and thrown should set their own status code before throwing and write their own messages (or maybe match their types to the default error type handling and let this set their codes and messages)
      res.status(res.statusCode >= 200 && res.statusCode < 400 ? 500 : res.statusCode)
      res.send(err.message || `Internal server error`)
    })

    app.listen(PORT, () => { console.log(`Partying hard on http://localhost:${PORT}`) })
    return { app, connection } // for testing
  } catch (err) {
    console.error(`Unable to connect to the database:`, err)
    console.log(`Not partying hard on any ports`)
  }
}

if (ENV !== `test` && ENV !== `script`) boot()

module.exports = boot // for testing
