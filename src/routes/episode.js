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
    res.status(200).json({ id: req.id, data: req.data })
  })

  // Get info on a particular episode
  router.get('/:id/:epNum', (req, res, next) => {
    getEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, data: req.data })
  })

  // Add an episode to an anime
  router.put('/:id', requireAuthorisation, (req, res, next) => {
    addEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({ id: req.id, status: 'Added episode' })
  })

  // Fetch episodes from nyaa and add them to the db
  router.post('/anime/:id', requireAuthorisation, (req, res, next) => {
    getAnime(req, res, next, db)
  }, (req, res, next) => {
    res.status(200).json({ id: req.id, data: req.data })
    fetchEpisodes(req, res, next, db)
  }, (req, res, next) => {
    addEpisodes(req, res, next, db)
  }, (req, res, next) => {
    getAnime(req, res, next, db)
  }, (req, res) => {
    console.log(`Finished updating episodes for ${req.data[0].title}. Request ID: ${req.id}`)
  })

  // Fetch episodes from current season
  router.post('/airing', requireAuthorisation, (req, res, next) => {
    getSeasonLatest(req, res, next, db)
  }, (req, res, next) => {
    res.status(200).json({ id: req.id, data: req.data })
    fetchEpisodes(req, res, next)
  }, (req, res, next) => {
    addEpisodes(req, res, next, db)
  }, (req, res) => {
    console.log('Finished updating seasonal episodes. Request ID: ' + req.id)
  })

  // Delete an episode
  router.delete('/:id/:epNum', requireAuthorisation, (req, res, next) => {
    deleteEpisode(req, res, next, db)
  }, (req, res) => {
    res.status(200).json({
      id: req.id,
      status: 'Deleted episode ' + req.params.epNum + ' from Anime: ' + req.params.id
    })
  })
  return router
}
