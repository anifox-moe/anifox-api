import { si as nyaapi } from '../lib/Nyaapi'
import anitomy from 'anitomy-js'
import { escapeProps } from '../helpers'

// Fetch an specific episode from an anime
const getEpisode = async (req, res, next, db) => {
  try {
    const result = await db.query(`SELECT * FROM episodes WHERE malID = '${req.params.id}'
      AND epNumber = '${req.params.epNum}'`)

    if (result.length < 1) {
      res.status(404)
      next('Episode not found')
    }

    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Get all episodes from an anime
const getEpisodesAnime = async (req, res, next, db) => {
  try {
    const result = await db.query(`SELECT * FROM episodes WHERE malID = '${req.params.id}'`)

    if (result.length < 1) {
      res.status(404)
      next('No Episodes found')
    }

    req.data = result
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Add a new episode to an anime
const addEpisode = async (req, res, next, db) => {
  try {
    let episode = req.body
    // Escape characters
    episode = escapeProps(episode)
    let columnsText = Object.keys(episode).map(episode => `\`${episode}\``).join(',')
    let valuesText = Object.values(episode).map(episode => `'${episode}'`).join(',').replace(/(\r\n|\n|\r)/gm, '\n')

    await db.query(`INSERT INTO episodes(episodeID, malID, ${columnsText}) VALUES(${req.params.id + episode.epNumber}, ${req.params.id}, ${valuesText})`)
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Delete an episode from an anime
const deleteEpisode = async (req, res, next, db) => {
  try {
    await db.query(`DELETE FROM episodes WHERE episodeID = ${req.params.id + req.params.epNum}`)
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

const fetchEpisodes = async (req, res, next, db) => {
  try {
    let data = []
    if (req.data.length > 1) {
      for (let key in req.data) {
        data.push(await processEpisodes(req, res, next, db, key))
      }
    } else {
      data = await processEpisodes(req, res, next, db, false)
    }
    req.data = data
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Get nyaa.si episodes for an anime
const processEpisodes = async (req, res, next, db, key) => {
  let term
  let malID
  if (!key) {
    term = req.data[0].title
    malID = req.data[0].malID
  } else {
    term = req.data[key].title
    malID = req.data[key].malID
  }

  let data = await nyaapi.searchAll({
    term,
    opts: {
      category: '1_2'
    }
  })

  if (isEmpty(data)) {
    res.status(404)
    return next('No episodes found')
  }

  // Get the team with with the most popular torrent
  let bestMatch = findHighestDownloads(data)

  let parsedMatch = await anitomy.parse(bestMatch[0].name)
  bestMatch.team = parsedMatch.release_group ? parsedMatch.release_group : ''
  bestMatch.resolution = parsedMatch.video_resolution ? parsedMatch.video_resolution : ''
  bestMatch.epNumber = parsedMatch.episode_number
  bestMatch.malID = malID
  let team = parsedMatch.release_group

  // Add properties from the anitomy parser (Episode number etc)
  await filter(data, async (value, index) => {
    let parsed = await anitomy.parse(value.name)
    // Remove episodes with varying res
    data[index].team = parsed.release_group ? parsed.release_group : ''
    data[index].resolution = parsed.video_resolution ? parsed.video_resolution : ''
    data[index].epNumber = parsed.episode_number
    data[index].malID = malID
  })

  // Filter data with those by best team
  if (typeof team !== 'undefined') {
    data = data.filter(value => {
      return value.team === team
    })
  } else {
    data = bestMatch
  }

  // Spaghetti code.
  // Every anime may have multiple sources from nyaa even by the same team due to resolution
  // This filters the ones that have duplicates and reduces them to the highest resolution of all of them
  let filtered = []
  let temp = []
  let seen = new Set()
  data.some((currentObject) => {
    currentObject.epNumber = typeof currentObject.epNumber === 'undefined' ? '01' : currentObject.epNumber
    currentObject.epNumber = Array.isArray(currentObject.epNumber) ? currentObject.epNumber.join('-') : currentObject.epNumber
    if (seen.size === seen.add(currentObject.epNumber).size) {
      filtered.push(currentObject)
    } else {
      temp.push(currentObject)
    }
  })

  let unique = filtered
  unique = unique.filter((obj, pos, arr) => {
    return arr.map(mapObj => mapObj.epNumber).indexOf(obj.epNumber) === pos
  })

  for (let object of unique) {
    let episodeNumber = object.epNumber

    let uniqueTemp = temp.filter(f => {
      return f.epNumber === episodeNumber
    })

    let filteredEpisodes = filtered.filter(value => {
      return value.epNumber === episodeNumber
    })

    filteredEpisodes = uniqueTemp.concat(filteredEpisodes)

    // Find highest resolution of pairs
    let highest = findMaxResolution(filteredEpisodes)

    temp = temp.filter(value => {
      return value.epNumber !== episodeNumber
    })

    temp = temp.concat(highest)
  }

  // Filter out batches (if needed or not)
  // Batches > Individuals
  let batches = getBatches(temp)
  if (!isEmpty(batches)) {
    temp = filterBatches(batches, temp)
  }
  return temp
}

const filterBatches = (arr, temp) => {
  let matching = []
  for (const batch in arr) {
    let max = arr.length - 1
    let episodeArray = arr[batch].epNumber.split('-')
    // Go through each value in temp and find any episodes that are outside the batch
    for (const episode in temp) {
      if (!temp[episode].epNumber.includes('-')) {
        if (parseInt(temp[episode].epNumber) < parseInt(episodeArray[0])) {
          matching.push(temp[episode])
        }
        if (parseInt(batch) === max) {
          // Last batch
          if (parseInt(temp[episode].epNumber) > parseInt(episodeArray[1])) {
            matching.push(temp[episode])
          }
        }
      }
    }
    matching = matching.concat(arr[batch])
  }
  return matching
}

const getBatches = (arr) => {
  // Get batches
  let batches = []
  for (let episode of arr) {
    if (episode.epNumber.includes('-') || episode.name.toLowerCase().includes('batch')) {
      batches.push(episode)
    }
  }
  batches.sort(compare)
  return batches
}

const isEmpty = (obj) => {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false
    }
  }
  return true
}

const findHighestDownloads = (arr) => {
  let data = []
  let max = 0
  let arrMax
  for (let i = 1, len = arr.length; i < len; i++) {
    let v = arr[i].nbDownload
    max = (v > arrMax) ? i : max
  }
  data.push(arr[max])
  return data
}

const findMaxResolution = (arr) => {
  let max = 0
  let arrMax
  for (let i = 1, len = arr.length; i < len; i++) {
    let v
    if (arr[i].resolution.includes('p')) {
      v = parseInt(arr[i].resolution.slice(0, -1))
    } else if (arr[i].resolution.includes('x')) {
      v = parseInt(arr[max].resolution.split('x')[0])
    }
    max = (v > arrMax) ? i : max
  }
  return arr[max]
}

const compare = (a, b) => {
  a = a.epNumber.split('-')
  b = b.epNumber.split('-')
  if (a[0] < b[0]) {
    return -1
  }
  if (a[0] > b[0]) {
    return 1
  }
  return 0
}

async function filter (arr, callback) {
  const fail = Symbol('fail')
  return (await Promise.all(arr.map(async (item, index) => (await callback(item, index)) ? item : fail))).filter(i => i !== fail)
}

// Add all episodes returned from a particlar anime
const addEpisodes = async (req, res, next, db) => {
  try {
    let data = req.data
    if (!data.length) {
      res.status(404)
      return next('No episodes found from adding')
    }
    for (let episode of data) {
      if (episode.epNumber.includes('-')) {
        let episodeArray = episode.epNumber.split('-')
        for (let i = parseInt(episodeArray[0]); i < parseInt(episodeArray[1]) + 1; i++) {
          await db.query(`INSERT INTO episodes (
          malID,
          epNumber,
          resolution,
          aired,
          link,
          torrent,
          magnet)
          VALUES(
          '${episode.malID}',
          '${i}',
          '${episode.resolution}',
          '${episode.timestamp}',
          '${episode.links.page}',
          '${episode.links.file}',
          '${episode.links.magnet}'
          )`)
        }
      } else {
        await db.query(`INSERT IGNORE INTO episodes (
          malID,
          epNumber,
          resolution,
          aired,
          link,
          torrent,
          magnet)
          VALUES(
          '${episode.malID}',
          '${episode.epNumber}',
          '${episode.resolution}',
          '${episode.timestamp}',
          '${episode.links.page}',
          '${episode.links.file}',
          '${episode.links.magnet}'
        )`)
      }
    }
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

export {
  getEpisode,
  fetchEpisodes,
  getEpisodesAnime,
  addEpisode,
  addEpisodes,
  deleteEpisode
}
