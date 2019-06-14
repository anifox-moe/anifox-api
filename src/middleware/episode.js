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

const fetchEpisodes = async (req, res, next, multiple) => {
  try {
    let data = []
    if (multiple) {
      for (let key in req.data) {
        data.push(await processEpisodes(req, res, next, key))
      }
    } else {
      data = await processEpisodes(req, res, next, false)
    }
    req.data = data
    next()
  } catch (e) {
    res.status(500)
    next(e)
  }
}

// Get nyaa.si episodes for an anime
const processEpisodes = async (req, res, next, key) => {
  let numberOfEpisodes
  let term
  let malID
  if (!key) {
    numberOfEpisodes = req.data[0].nbEp
    term = req.data[0].title
    malID = req.data[0].malID
  } else {
    numberOfEpisodes = req.data[key].nbEp
    term = req.data[key].title
    malID = req.data[key].malID
  }
  if (term === 'One Piece') {
    numberOfEpisodes = 900
  }
  let data = await nyaapi.searchAll({
    term,
    opts: {
      category: '1_2'
    }
  })
  if (!data.length) {
    res.status(404)
    return next('No episodes found')
  }
  // Get the team with with the most popular torrent
  let highest = data.reduce((accumulator, currentValue) => {
    return [
      Math.min(currentValue.nbDownload, accumulator[0]),
      Math.max(currentValue.nbDownload, accumulator[1])
    ]
  }, [Number.MAX_VALUE, Number.MIN_VALUE])
  let bestMatch = data.filter(value => {
    return value.nbDownload === highest[1].toString()
  })
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

  // Spaghetti code. I know this is shit, just don't even bother trying to figure out what its doing
  // Every anime may have multiple sources from nyaa even by the same team due to resolution
  // This filters the ones that have duplicates and reduces them to the highest resolution of all of them
  let filtered = []
  let temp = []
  let seen = new Set()
  data.some((currentObject) => {
    currentObject.epNumber = typeof currentObject.epNumber === 'undefined' ? '01' : currentObject.epNumber
    currentObject.epNumber = Array.isArray(currentObject.epNumber) ? currentObject.epNumber.join('-') : currentObject.epNumber
    if (!Array.isArray(currentObject.epNumber) && data.length > 1) {
      if (seen.size === seen.add(currentObject.epNumber).size) {
        filtered.push(currentObject)
      } else {
        temp.push(currentObject)
      }
    } else if (Array.isArray(currentObject.epNumber) && data.length > 1) {
      if (currentObject.epNumber.split('-')[1] < numberOfEpisodes) {
        if (seen.size === seen.add(currentObject.epNumber).size) {
          filtered.push(currentObject)
        } else {
          temp.push(currentObject)
        }
      }
    } else {
      if (seen.size === seen.add(currentObject.epNumber).size) {
        filtered.push(currentObject)
      } else {
        temp.push(currentObject)
      }
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
    filteredEpisodes = filteredEpisodes.reduce((prev, current) => {
      if (current.resolution.includes('p')) {
        return prev.resolution.slice(0, -1) < current.resolution.slice(0, -1) ? prev : current
      } else {
        return prev.resolution.split('x')[1] < current.resolution.split('x')[1] ? prev : current
      }
    })
    temp = temp.filter(value => {
      return value.epNumber !== episodeNumber
    })
    temp = temp.concat(filteredEpisodes)
  }
  return temp
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
      return next('No episodes found')
    }
    for (let episode of data) {
      if (episode.epNumber.includes('-')) {
        let episodeArray = episode.epNumber.split('-')
        for (let i = parseInt(episodeArray[0]); i < parseInt(episodeArray[1]) + 1; i++) {
          await db.query(`INSERT IGNORE INTO episodes (
          episodeID,
          malID,
          epNumber,
          resolution,
          aired,
          link,
          torrent,
          magnet)
          VALUES(
          '${episode.malID + i}',
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
          episodeID,
          malID,
          epNumber,
          resolution,
          aired,
          link,
          torrent,
          magnet)
          VALUES(
          '${episode.malID + episode.epNumber}',
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
