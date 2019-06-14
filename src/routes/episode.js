import { Router } from 'express'
import {
  getEpisode,
  fetchEpisodes,
  getEpisodesAnime,
  addEpisode,
  addEpisodes,
  deleteEpisode
} from '../middleware/episode'
import { getSeasonLatest } from '../middleware/season'
import { getAnime } from '../middleware/anime'
import { requireAuthorisation } from '../middleware'

export default (db) => {
  const router = Router()

  // Get all episodes for an anime
  router.get('/:id', (req, res, next) => {
    getEpisodesAnime(req, res, next, db)
  }, (req, res) => {
    res.status(200).json(req.data)
  })

  // Get info on a particular episode
  router.get('/:id/:epNum', (req, res, next) => {
    getEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json(req.data)
  })

  // Add an episode to an anime
  router.put('/:id', requireAuthorisation, (req, res, next) => {
    addEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ status: 'Added episode' })
  })

  // Fetch episodes from nyaa and add them to the db
  router.post('/anime/:id', requireAuthorisation, (req, res, next) => {
    getAnime(req, res, next, db)
  }, (req, res, next) => {
    fetchEpisodes(req, res, next, false)
  }, (req, res, next) => {
    addEpisodes(req, res, next, db)
  }, (req, res) => {
    res.status(200).json(req.data)
  })

  // Fetch episodes from current season
  router.post('/airing', requireAuthorisation, (req, res, next) => {
    getSeasonLatest(req, res, next, db)
  }, (req, res, next) => {
    fetchEpisodes(req, res, next, true)
  }, (req, res) => {
    res.status(200).json(req.data)
  })

  // Delete an episode
  router.delete('/:id/:epNum', requireAuthorisation, (req, res, next) => {
    deleteEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ status: 'Deleted episode ' + req.params.id + ' from Anime: ' + req.params.id })
  })
  return router
}
