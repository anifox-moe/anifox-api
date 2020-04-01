import moment from 'moment'
import { escapeProps, convertArrayToObject } from '../helpers'
import matchSorter from 'match-sorter'

const possibleTypes = ['TV', 'TVNew', 'OVAs', 'ONAs', 'Movies', 'Specials']

// Get a particular anime
const getAnime = async (req, res, next, db) => {
  try {
    const result = await db.query(`SELECT * FROM anime WHERE malID = '${req.params.id}'`)
    if (result.length < 1) {
      res.status(404)
      next('No Anime found')
    }
    req.data = convertArrayToObject(result, 'malID')
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Return all anime
const getAllAnime = async (req, res, next, db) => {
  try {
    let result
    if (typeof req.query.genre !== 'undefined') {  
      result = await db.query(`SELECT * FROM anime WHERE genres LIKE '%${req.query.genre}%'`)
    } else {
      // Construct object instead of array, keys being the malID
      result = await db.query(`SELECT * FROM anime`)
    }
    req.data = convertArrayToObject(result, 'malID')
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Return all anime by type
const getAllAnimeType = async (req, res, next, db) => {
  try {
    const type = req.params.type
    if (!possibleTypes.includes(type)) {
      res.status(400)
      next('Cannot find matching type, Options are: ' + possibleTypes.join(', '))
      return
    }
    const result = await db.query(`SELECT * FROM anime WHERE type='${type}'`)
    req.data = convertArrayToObject(result, 'malID')
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Get airing anime
const getAiringAnime = async (req, res, next) => {
  try {
    // Get number of episodes for each anime and multiply it by x weeks + the date it started
    const data = req.data
    let currentTime = moment().unix()
    const result = data.filter(value => {
      return (((value.nbEp * 604800 + value.releaseDate) > currentTime) || (value.nbEp === 0 && value.type === 'TV'))
    })
    req.data = convertArrayToObject(result, 'malID')
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Update an existing anime
const updateAnime = async (req, res, next, db) => {
  try {
    let anime = req.body
    let malID = req.params.id

    if (Object.keys(anime).length === 0) {
      res.status(400)
      next('No body data')
    }

    // Escape characters
    anime = escapeProps(anime)
    let builtString = Object.keys(anime).map(key => key + '=' + '\'' + anime[key] + '\'').join(',')
    const result = await db.query(`UPDATE anime SET ${builtString} WHERE malID = ${malID}`)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Delete anime
const deleteAnime = async (req, res, next, db) => {
  try {
    // Delete anime record
    await db.query(`DELETE FROM anime WHERE malID = ${req.params.id}`)
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Add a new anime
const addAnime = async (req, res, next, db) => {
  try {
    let anime = req.body
    let malID = req.params.id
    // Escape characters
    anime = escapeProps(anime)
    let columnsText = Object.keys(anime).map(anime => `\`${anime}\``).join(',')
    let valuesText = Object.values(anime).map(anime => `'${anime}'`).join(',').replace(/(\r\n|\n|\r)/gm, '\n')

    const result = await db.query(`INSERT INTO anime(malID, ${columnsText}) VALUES(${malID}, ${valuesText})`)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Peform SQL query search, return anime that match keyword
const searchAnime = async (req, res, next, db) => {
  try {
    const keyword = req.params.keyword
    let result = await db.query(`SELECT * FROM anime WHERE title LIKE '%${keyword}%'`)
    req.data = convertArrayToObject(result, 'malID')
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

export {
  getAllAnime,
  getAllAnimeType,
  getAnime,
  deleteAnime,
  addAnime,
  getAiringAnime,
  updateAnime,
  searchAnime
}
