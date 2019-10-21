import malScraper from 'mal-scraper'
import moment from 'moment'
import { escapeProps, deleteUnusedProps, getNormalised } from '../helpers'

const maxYear = 1901 + (new Date()).getYear()
const possibleSeasons = ['winter', 'fall', 'summer', 'spring']
const possibleTypes = ['TV', 'TVNew', 'TVCon', 'OVAs', 'ONAs', 'Movies', 'Specials']

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
      return next(`Year must be between 1917 and ${maxYear}.`)
    }

    if (!possibleSeasons.includes(season)) {
      res.status(400)
      return next(`Invalid syntax, Possible options are ${possibleSeasons.join(', ')}`)
    }

    if (!possibleTypes.includes(type)) {
      res.status(400)
      return next(`Invalid type provided, Possible options are ${possibleTypes.join(', ')}`)
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
    let type = req.params.type
    let data = req.data
    let builtString = []

    if (type === 'TVCon') { // Don't allow continuing anime
      res.status(405)
      return next('Cannot use TVCon')
    }

    // Filter the array from bad anime using a normalised function
    let filtered = data.filter(value => {
      if (typeof value.picture === 'string') { // Scraper sometimes sends half broken data
        value.malID = value.link.split('/')[4] // Extract malID from the link
        value.type = type === 'TVNew' ? 'TV' : type // Set the respective TV information to

        value.nbEp = value.nbEp.includes('?') ? '0' : parseInt(value.nbEp).toString() // Sometimes the episodes is returned as a '?'

        // Escape strings inside props of anime
        value = getNormalised(value) > 0 ? escapeProps(deleteUnusedProps(value)) : null // Delete score and members as we dont store these

        if (value !== null) {
          const time = moment(moment(value.releaseDate).format('YYYY-MM-DD')).unix() // Built unix timestamp from date
          value.releaseDate = value.releaseDate != null ? time : value.releaseDate
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

    for (let type in data) { // Looping through each of the categories
      if (type !== 'TVCon' && type !== 'TV') { // Don't allow continuing anime (TV also contains TVCon)
        let filtered = data[type].filter(value => {
          if (typeof value.picture === 'string') {
            value.malID = value.link.split('/')[4] // Extract malID from the link
            value.type = type === 'TVNew' ? 'TV' : type // Set the respective TV information to

            value.nbEp = value.nbEp.includes('?') ? '0' : parseInt(value.nbEp).toString() // Sometimes the episodes is returned as a '?'

            value = getNormalised(value) > 0 && !NaN ? escapeProps(deleteUnusedProps(value)) : null // Delete score and members as we dont store these

            if (value !== null) {
              const time = moment(moment(value.releaseDate).format('YYYY-MM-DD')).unix() // Built unix timestamp from date
              value.releaseDate = value.releaseDate != null ? time : value.releaseDate
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
    console.log(selectString)
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
