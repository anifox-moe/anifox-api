import { si as nyaapi } from '../lib/Nyaapi'
import anitomy from 'anitomy-js'
import matchSorter from 'match-sorter'
import {
  escapeProps,
  isEmpty,
  findHighestDownloads,
  findMaxResolution,
  findHighestEpisodes,
  compare,
  filter
} from '../helpers'

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
  let numberOfEpisodes
  let type
  if (!key) {
    term = req.data[0].title
    malID = req.data[0].malID
    numberOfEpisodes = req.data[0].nbEp
    type = req.data[0].type
  } else {
    term = req.data[key].title
    malID = req.data[key].malID
    numberOfEpisodes = req.data[key].nbEp
    term = req.data[0].type
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

  let parsedMatch = await anitomy.parse(bestMatch.name)
  bestMatch.team = parsedMatch.release_group ? parsedMatch.release_group : ''
  bestMatch.resolution = parsedMatch.video_resolution ? parsedMatch.video_resolution : ''
  bestMatch.epNumber = parsedMatch.episode_number
  bestMatch.malID = malID
  let team = parsedMatch.release_group

  // Add properties from the anitomy parser (Episode number etc)
  await filter(data, async (value, index) => {
    let parsed = await anitomy.parse(value.name)
    // Remove episodes with varying res
    if (Array.isArray(parsed.video_resolution)) {
      parsed.video_resolution = parsed.video_resolution[0]
    }
    data[index].team = parsed.release_group ? parsed.release_group : ''
    data[index].resolution = parsed.video_resolution ? parsed.video_resolution : '480p'
    data[index].epNumber = parsed.episode_number
    data[index].malID = malID
    data[index].title = parsed.anime_title
    console.log(parsed.anime_title + ' /*^% ' + term)
    console.log(parsed.anime_title.length + ' /*^% ' + term.length)
  })

  let totalDownloads = 0
  let totalSeeders = 0
  // Filter data with those by best team
  if (typeof team !== 'undefined') {
    data = data.filter(value => {
      if (value.team === team) {
        totalDownloads += parseInt(value.nbDownload)
        totalSeeders += parseInt(value.seeders)
        return value
      }
    })
  } else {
    data = [bestMatch]
  }

  // Quick check to see if the top episode is a batch by guessing if it's got no keyword 'batch' or no episode number
  // && that the downloads > every other episode download accumulated
  // Compare total downloads for all other shows but bestMatch
  if (parseInt(bestMatch.nbDownload) + 100 > totalDownloads - parseInt(bestMatch.nbDownload) || parseInt(bestMatch.seeders) > totalSeeders - parseInt(bestMatch.seeders)) {
    bestMatch.epNumber = ['1', numberOfEpisodes.toString()]
    data = [bestMatch]
  }

  // If the anime is not a 'special or ova' then ignore ep 0
  if (type !== 'Specials' || type !== 'Ovas') {
    data = data.filter(value => {
      return parseInt(value.epNumber) !== 0 && !value.name.toLowerCase().includes('special')
    })
  }

  data = matchSorter(data, term, { keys: ['title'] })

  // Spaghetti code.
  // Every anime may have multiple sources from nyaa even by the same team due to resolution
  // This filters the ones that have duplicates and reduces them to the highest resolution of all of them
  let filtered = []
  let temp = []
  let seen = new Set()
  data.some((currentObject) => {
    currentObject.epNumber = typeof currentObject.epNumber === 'undefined' ? [1, numberOfEpisodes] : currentObject.epNumber
    currentObject.epNumber = Array.isArray(currentObject.epNumber) ? currentObject.epNumber.join('-') : currentObject.epNumber
    currentObject.epNumber = currentObject.epNumber.startsWith('0') ? currentObject.epNumber.slice(1) : currentObject.epNumber
    if (seen.size === seen.add(currentObject.epNumber).size) {
      filtered.push(currentObject)
    } else {
      temp.push(currentObject)
    }
  })

  let unique = filtered
  unique = unique.filter((obj, index, arr) => {
    return arr.map(mapObj => mapObj.epNumber).indexOf(obj.epNumber) === index
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

  arr = arr.length > 1 ? sortRedundantBatches(arr) : arr
  console.table(arr)
  let max = findHighestEpisodes(arr)

  for (const batch in arr) {
    let episodeArray = arr[batch].epNumber.split('-')
    // Go through each value in temp and find any episodes that are outside the batch
    for (const episode in temp) {
      if (!temp[episode].epNumber.includes('-')) {
        // Only non batch episodes here
        if (arr[batch].epNumber !== max.epNumber && parseInt(temp[episode].epNumber) < parseInt(episodeArray[0])) {
          matching.push(temp[episode])
        } else if (max.epNumber === arr[batch].epNumber && parseInt(temp[episode].epNumber) > parseInt(episodeArray[1])) {
          // Last batch
          matching.push(temp[episode])
        }
      }
    }
    matching = matching.concat(arr[batch])
  }
  console.table(matching)
  return matching
}

const sortRedundantBatches = (arr) => {
  let first = arr[0].epNumber.split('-')
  let second = typeof arr[1] !== 'undefined' ? arr[1].epNumber.split('-') : null
  let third = typeof arr[2] !== 'undefined' ? arr[2].epNumber.split('-') : null
  // 0 and 1 index represent low and high values of a batch
  if (arr.length <= 1) {
    return arr
  } else if (arr.length === 2) {
    return first[1] >= second[0] ? [arr[1]] : arr
  } else {
    if (first[1] >= second[0] && first[1] >= third[0]) {
      return [arr[0]].concat(sortRedundantBatches(arr.slice(2)))
    } else {
      arr[1].epNumber = `${first[1]}-${second[1]}`
      return [arr[0]].concat(sortRedundantBatches(arr.slice(1)))
    }
  }
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

// Add all episodes returned from a particlar anime
const addEpisodes = async (req, res, next, db) => {
  try {
    let data = req.data
    if (!data.length) {
      res.status(404)
      return next('No episodes found from adding')
    }
    if (Array.isArray(data[0])) {
      for (const anime of data) {
        runEpisodesAdd(res, req, next, anime, db)
      }
    } else {
      runEpisodesAdd(res, req, next, data, db)
    }
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

const runEpisodesAdd = async (res, req, next, data, db) => {
  try {
    for (let episode of data) {
      if (episode.epNumber.includes('-')) {
        let episodeArray = episode.epNumber.split('-')
        // console.log(parseInt(episodeArray[0]))
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
          '${episode.epNumber}',
          '${episode.resolution}',
          '${episode.timestamp}',
          '${episode.links.page}',
          '${episode.links.file}',
          '${episode.links.magnet}'
        )`)
      }
    }
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
