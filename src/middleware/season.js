import malScraper from '../lib/MalScraper'
import moment from 'moment'
import { escapeProps, deleteUnusedProps, getNormalised } from '../helpers'

const maxYear = 1901 + (new Date()).getYear()
const possibleSeasons = ['winter', 'fall', 'summer', 'spring']

// Get all new seasonal data from MAL
const refreshSeason = async (req, res, next) => {
  try {
    let year = req.params.year
    let season = req.params.season
    let type = req.params.type

    const result = await malScraper.getSeason(year, season, type)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e.message)
  }
}

// Pull seasonal data from db
const getSeason = async (req, res, next, db) => {
  try {
    // Release date is stored as a unix date in db
    // Convert the input year/season to a year/month
    const season = req.params.season
    const year = req.params.year

    if (!(year <= maxYear) || !(year >= 1917)) {
      res.status(400)
      next(`Year must be between 1917 and ${maxYear}.`)
      return
    }
    if (!possibleSeasons.includes(season)) {
      res.status(400)
      next(`Invalid syntax, Possible options are ${possibleSeasons.join(', ')}`)
      return
    }

    let seasonNumeric = possibleSeasons.indexOf(season)
    let seasonMonth = seasonNumeric === 0 ? 1 : 12 / seasonNumeric

    // Use moment to convert this year/month to a unix stamp
    const m = moment(`${year}-${seasonMonth.toString().length > 1 ? seasonMonth : '0' + seasonMonth}-01`)
    const result = await db.query(`SELECT * FROM anime WHERE releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

const getSeasonLatest = async (req, res, next, db) => {
  try {
    let m = moment()
    const result = await db.query(`SELECT * FROM anime WHERE releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Pull seasonal data from db by type (TV, OVA etc)
const getSeasonType = async (req, res, next, db) => {
  try {
    // Release date is stored as a unix date in db
    // Convert the input year/season to a year/month
    const type = req.params.type
    const season = req.params.season
    const year = req.params.year

    if (!(year <= maxYear) || !(year >= 1917)) {
      res.status(400)
      next(`Year must be between 1917 and ${maxYear}.`)
      return
    }
    if (!possibleSeasons.includes(season)) {
      res.status(400)
      next(`Invalid syntax, Possible options are ${possibleSeasons.join(', ')}`)
      return
    }

    let seasonNumeric = possibleSeasons.indexOf(season)
    let seasonMonth = seasonNumeric === 0 ? 1 : 12 / seasonNumeric

    // Use moment to convert this year/month to a unix stamp
    const m = moment(`${year}-${seasonMonth.toString().length > 1 ? seasonMonth : '0' + seasonMonth}-01`)
    const result = await db.query(`SELECT * FROM anime WHERE type='${type}' AND releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Update db with refreshed data for specific type
const updateSeasonType = async (req, res, next, db) => {
  try {
    console.log(req.data)
    let type = req.params.type
    let data = req.data
    let builtString = []
    if (type === 'TVCon') {
      res.status(405)
      next('Cannot use TVCon')
    } else {
      // Filter the array from bad anime
      // Escape strings inside props of anime
      // Delete score and members as we dont store these
      let filtered = data.filter(value => {
        if (typeof value.picture === 'string') {
          value.malID = value.link.split('/')[4]
          value.type = type === 'TVNew' ? 'TV' : type
          value = getNormalised(value) > 0 ? escapeProps(deleteUnusedProps(value)) : null
          if (value !== null) {
            value.releaseDate = value.releaseDate != null ? moment(value.releaseDate).unix() : value.releaseDate
            builtString.push(`(${Object.values(value).map(obj => `'${obj}'`).join(',')})`)
            return value
          }
        }
      })
      if (!Array.isArray(filtered) || !filtered.length) {
        res.status(403)
        next('Season is empty after filter')
        return
      }
      let selectString = Object.keys(filtered[0]).join(',')
      let queryString = Object.keys(filtered[0]).map(property => `${property}=VALUES(${property})`).join(',')
      queryString += ';'

      await db.query(`INSERT INTO anime (${selectString}) VALUES ${builtString} ON DUPLICATE KEY UPDATE ${queryString}`)
      req.data = filtered
      next()
    }
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Update a season with all types included
const updateSeason = async (req, res, next, db) => {
  try {
    let data = req.data
    let builtString = []
    let selectString = []
    let queryString = []
    let filteredData = []
    for (let type in data) {
      if (type !== 'TVCon') {
        // Filter the array from bad anime
        // Escape strings inside props of anime
        // Delete score and members as we dont store these
        // console.log(data[type])
        let filtered = data[type].filter(value => {
          if (typeof value.picture === 'string') {
            value.malID = value.link.split('/')[4]
            value.type = type === 'TVNew' ? 'TV' : type
            value = getNormalised(value) > 0 && !NaN ? escapeProps(deleteUnusedProps(value)) : null
            if (value !== null) {
              value.releaseDate = value.releaseDate != null ? moment(value.releaseDate).unix() : value.releaseDate
              builtString.push(`(${Object.values(value).map(obj => `'${obj}'`).join(',')})`)
              return value
            }
          }
        })
        if (Array.isArray(filtered) && filtered.length > 0) {
          selectString = Object.keys(filtered[0]).join(',')
          queryString.push(Object.keys(filtered[0]).map(property => `${property}=VALUES(${property})`).join(','))
          filteredData.push(filtered)
        }
      }
    }
    await db.query(`INSERT INTO anime (${selectString}) VALUES ${builtString} ON DUPLICATE KEY UPDATE ${queryString}`)
    req.data = filteredData
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

export {
  getSeason,
  getSeasonLatest,
  getSeasonType,
  refreshSeason,
  updateSeason,
  updateSeasonType
}
