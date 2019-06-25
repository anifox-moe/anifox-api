import { Router } from 'express'
import {
  getAnime,
  getAllAnimeType,
  getAiringAnime,
  updateAnime,
  deleteAnime,
  addAnime,
  getAllAnime
} from '../middleware/anime'
import { getSeasonLatest } from '../middleware/season'
import { requireAuthorisation } from '../middleware'

export default (db) => {
  const router = Router()

  // Get an individual anime
  router.get('/:id', (req, res, next) => {
    getAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, data: req.data })
  })

  // If no ID is provided then return all anime
  router.get('/', (req, res, next) => {
    getAllAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, data: req.data })
  })

  // Get all anime by type
  router.get('/type/:type', (req, res, next) => {
    getAllAnimeType(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, data: req.data })
  })

  // Get airing anime
  router.get('/season/airing', (req, res, next) => {
    getSeasonLatest(req, res, next, db)
  }, getAiringAnime, (req, res) => {
    res.status(200).json({ id: req.id, data: req.data })
  })

  // Update specific anime with fields || Admin only
  router.post('/:id', requireAuthorisation, (req, res, next) => {
    updateAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, status: 'Updated' })
  })

  // Add a new anime
  router.put('/:id', requireAuthorisation, (req, res, next) => {
    addAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, status: 'Added' })
  })

  // Delete anime
  router.delete('/:id', requireAuthorisation, (req, res, next) => {
    deleteAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, status: 'Deleted' })
  })

  return router
}
