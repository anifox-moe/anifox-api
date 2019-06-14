import { Router } from 'express'
import { version } from '../../package.json'
import { anime, episode, season } from '../routes'

export default (db) => {
  let api = Router()

  // Api paths
  api.use('/anime', anime(db))
  api.use('/episode', episode(db))
  api.use('/season', season(db))

  // Root level path
  api.get('/', (req, res) => {
    res.json({ version })
  })

  return api
}
