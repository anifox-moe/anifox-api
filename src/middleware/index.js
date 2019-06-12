import malScraper from '../lib/MalScraper';
import { si as nyaapi } from '../lib/Nyaapi';
import moment from 'moment';
import anitomy from 'anitomy-js';


const maxYear = 1901 + (new Date()).getYear()
const possibleTypes = ['TV', 'TVNew', 'OVAs', 'ONAs', 'Movies', 'Specials']

//Get a particular anime
const getAnime = async (req, res, next, db) => {
  try{
    const result = await db.query(`SELECT * FROM anime WHERE malID = '${req.params.id}'`)
    if(result.length < 1) {
      res.status(404);
      next('No Anime found')
    }
    req.data = result;
    next();

  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Return all anime
const getAllAnime = async (req, res, next, db) => {
  try{
    const result = await db.query(`SELECT * FROM anime`);
    req.data = result;
    next();
  } catch(e) {
    res.status(500)
    next(e);
  }
}

//Return all anime by type
const getAllAnimeType = async (req, res, next, db) => {
  try {
    const type = req.params.type;
    if (!possibleTypes.includes(type)) {
      next('Cannot find matching type, Options are: ' + possibleTypes.join(', '))
      return;
    }
    const result = await db.query(`SELECT * FROM anime WHERE type='${type}'`);
    req.data = result;
    next();
  } catch (e) {
    res.status(500)
    next(e);
  }
}

//Get airing anime
const getAiringAnime = async (req, res, next) => {
  try{
    //Get number of episodes for each anime and multiply it by x weeks + the date it started
    const data = req.data;
    let currentTime = moment().unix()
    const result = data.filter(value => {
      return((value.nbEp * 604800 + value.releaseDate) > currentTime || value.nbEp === 0 && value.type === 'TV')
    })
    req.data = result
    next()
  } catch(e) {
    res.status(500)
    next(e)
  }
}

//Get all new seasonal data from MAL
const refreshSeason = async (req, res, next) => {
  try{
    let year = req.params.year;
    let season = req.params.season;
    let type = req.params.type;

    const result = await malScraper.getSeason(year, season, type)
    req.data = result;
    next();
  } catch(e) {
    res.status(500)
    next(e.message);
  }
}

//Pull seasonal data from db
const getSeason = async (req, res, next, db) => {
  try{
    //Release date is stored as a unix date in db
    //Convert the input year/season to a year/month
    const season = req.params.season;
    const year = req.params.year;
    const possibleSeasons = ['winter', 'fall', 'summer', 'spring'];

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

    let seasonNumeric = possibleSeasons.indexOf(season);
    let seasonMonth = seasonNumeric === 0 ? 1 : 12 / seasonNumeric;

    //Use moment to convert this year/month to a unix stamp
    const m = moment(`${year}-${seasonMonth.toString().length>1 ? seasonMonth : '0'+seasonMonth}-01`);
    const result = await db.query(`SELECT * FROM anime WHERE releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result;
    next()
  } catch(e) {
    res.status(500);
    next(e);
  }
}

const getSeasonLatest = async (req, res, next, db) => {
  try{
    let m = moment();
    const result = await db.query(`SELECT * FROM anime WHERE releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result;
    next()
  } catch(e){
    res.status(500)
    next(e)
  }
}

//Pull seasonal data from db by type (TV, OVA etc)
const getSeasonType = async (req, res, next, db) => {
  try {
    //Release date is stored as a unix date in db
    //Convert the input year/season to a year/month
    const type = req.params.type;
    const season = req.params.season;
    const year = req.params.year;

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

    const possibleSeasons = ['winter', 'fall', 'summer', 'spring'];
    let seasonNumeric = possibleSeasons.indexOf(season);
    let seasonMonth = seasonNumeric === 0 ? 1 : 12 / seasonNumeric;

    //Use moment to convert this year/month to a unix stamp
    const m = moment(`${year}-${seasonMonth.toString().length > 1 ? seasonMonth : '0' + seasonMonth}-01`);
    const result = await db.query(`SELECT * FROM anime WHERE type='${type}' AND releaseDate BETWEEN ${m.unix() - 7776000} AND ${m.unix() + 7776000}`)
    req.data = result;
    next()
  } catch (e) {
    res.status(500);
    next(e);
  }
}

//Update db with refreshed data for specific type
const updateSeasonType = async (req, res, next, db) => {
  try{
    let type = req.params.type;
    let data = req.data;
    console.log(data)
    let builtString = [] 
    if(type === 'TVCon'){
      res.status(405)
      next('Cannot use TVCon');
    }else{
      //Filter the array from bad anime
      //Escape strings inside props of anime
      //Delete score and members as we dont use these
      let filtered = data.filter(value => {
        if (typeof value.picture === 'string') {
          value.malID = value.link.split('/')[4];
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
        res.status(403);
        next('Season is empty after filter')
        return
      }
      let selectString = Object.keys(filtered[0]).join(',')
      let queryString = Object.keys(filtered[0]).map(property => `${property}=VALUES(${property})`).join(',');
      queryString += ';';

      await db.query(`INSERT INTO anime (${selectString}) VALUES ${builtString} ON DUPLICATE KEY UPDATE ${queryString}`);
      req.data = filtered;
      next();
    }
  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Update a season with all types included
const updateSeason = async (req, res, next, db) => {
  try {
    let data = req.data;
    let builtString = []
    let selectString = []
    let queryString = []
    let filteredData = []
    for(let type in data){
      if(type != 'TVCon'){
        //Filter the array from bad anime
        //Escape strings inside props of anime
        //Delete score and members as we dont use these
        //console.log(data[type])
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

//Update an existing anime
const updateAnime = async (req, res, next, db) => {
  try{
    let anime = req.body;
    let malID = req.params.id;

    if(Object.keys(anime).length === 0){
      res.status(400);
      next('No body data')
    }

    //Escape characters
    anime = escapeProps(anime);
    let builtString = Object.keys(anime).map(key => key + '=' + '\'' + anime[key] + '\'').join(',')
    const result = await db.query(`UPDATE anime SET ${builtString} WHERE malID = ${malID}`)
    req.data = result;
    next()
  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Delete anime
const deleteAnime = async (req, res, next, db) => {
  try{
    //Delete anime record
    await db.query(`DELETE FROM anime WHERE malID = ${req.params.id}`)
    next();
  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Add a new anime
const addAnime = async (req, res, next, db) => {
  try{
    let anime = req.body;
    let malID = req.params.id;
    //Escape characters
    anime = escapeProps(anime);
    let columnsText = Object.keys(anime).map(anime => `\`${anime}\``).join(',');
    let valuesText = Object.values(anime).map(anime => `'${anime}'`).join(',').replace(/(\r\n|\n|\r)/gm, "\n");

    const result = await db.query(`INSERT INTO anime(malID, ${columnsText}) VALUES(${malID}, ${valuesText})`);
    req.data = result;
    next();
  } catch(e){
    res.status(500);
    next(e);
  }
}

//Fetch an specific episode from an anime
const getEpisode = async (req, res, next, db) => {
  try{
    const result = await db.query(`SELECT * FROM episodes WHERE malID = '${req.params.id}'
      AND epNumber = '${req.params.epNum}'`);

    if (result.length < 1) {
      res.status(404);
      next('Episode not found')
    }

    req.data = result;
    next();
  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Get all episodes from an anime
const getEpisodesAnime = async (req, res, next, db) => {
  try{
    const result = await db.query(`SELECT * FROM episodes WHERE malID = '${req.params.id}'`);

    if (result.length < 1) {
      res.status(404);
      next('No Episodes found')
    }

    req.data = result;
    next();  

  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Add a new episode to an anime
const addEpisode = async (req, res, next, db) => {
  try{
    let episode = req.body;
    //Escape characters
    episode = escapeProps(episode);
    let columnsText = Object.keys(episode).map(episode => `\`${episode}\``).join(',');
    let valuesText = Object.values(episode).map(episode => `'${episode}'`).join(',').replace(/(\r\n|\n|\r)/gm, "\n");

    await db.query(`INSERT INTO episodes(episodeID, malID, ${columnsText}) VALUES(${req.params.id + episode.epNumber}, ${req.params.id}, ${valuesText})`)
    next();
  } catch(e) {
    res.status(500);
    next(e);
  }
}

//Delete an episode from an anime
const deleteEpisode = async (req, res, next, db) => {
  try{
    await db.query(`DELETE FROM episodes WHERE episodeID = ${$req.params.id + req.params.epNum}`);
    next();
  } catch(e) {
    res.status(500);
    next(e);
  }
}

const fetchEpisodes = async (req, res, next, multiple) => {
  try {
    let data = []
    if(multiple) {
      for(let key in req.data) {
        data.push(await processEpisodes(req, res, next, key))
      }
    } else {
      data = await processEpisodes(req, res, next, false)
    }
    req.data = data;
    next();
  } catch (e) {
    res.status(500)
    next(e)
  }
}

//Get nyaa.si episodes for an anime
const processEpisodes = async (req, res, next, key) => {
  let numberOfEpisodes
  let term
  let malID
  if(!key) {
    numberOfEpisodes = req.data[0].nbEp
    term = req.data[0].title
    malID = req.data[0].malID
  } else {
    numberOfEpisodes = req.data[key].nbEp
    term = req.data[key].title
    malID = req.data[key].malID
  }
  if (term === 'One Piece') {
    numberOfEpisodes = 900;
  }
  let data = await nyaapi.searchAll({
    term,
    opts: {
      category: '1_2'
    }
  })
  //data = data.filter(value => {
  //return value.category.code == '1_2'
  //})
  if (!data.length) {
    res.status(404)
    return next('No episodes found')
  }
  //Get the team with with the most popular torrent
  let highest = data.reduce((accumulator, currentValue) => {
    return [
      Math.min(currentValue.nbDownload, accumulator[0]),
      Math.max(currentValue.nbDownload, accumulator[1])
    ];
  }, [Number.MAX_VALUE, Number.MIN_VALUE])
  let bestMatch = data.filter(value => {
    return value.nbDownload == highest[1]
  })
  let parsedMatch = await anitomy.parse(bestMatch[0].name)
  bestMatch.team = parsedMatch.release_group ? parsedMatch.release_group : ''
  bestMatch.resolution = parsedMatch.video_resolution ? parsedMatch.video_resolution : ''
  bestMatch.epNumber = parsedMatch.episode_number
  bestMatch.malID = malID
  let team = parsedMatch.release_group;

  //Add properties from the anitomy parser (Episode number etc)
  await filter(data, async (value, index) => {
    let parsed = await anitomy.parse(value.name)
    //Remove episodes with varying res
    data[index].team = parsed.release_group ? parsed.release_group : ''
    data[index].resolution = parsed.video_resolution ? parsed.video_resolution : ''
    data[index].epNumber = parsed.episode_number
    data[index].malID = malID
  })

  //Filter data with those by best team
  if (typeof team !== 'undefined') {
    data = data.filter(value => {
      return value.team === team;
    })
  } else {
    data = bestMatch
  }

  //Spaghetti code. I know this is shit, just don't even bother trying to figure out what its doing
  //Every anime may have multiple sources from nyaa even by the same team due to resolution
  //This filters the ones that have duplicates and reduces them to the lowest resolution of all of them
  let filtered = []
  let temp = []
  let seen = new Set();
  data.some((currentObject) => {
    typeof currentObject.epNumber === 'undefined' ? currentObject.epNumber = '01' : currentObject.epNumber
    currentObject.epNumber = Array.isArray(currentObject.epNumber) ? currentObject.epNumber.join('-') : currentObject.epNumber
    if (!Array.isArray(currentObject.epNumber) && data.length > 1) {
      if (seen.size === seen.add(currentObject.epNumber).size) {
        filtered.push(currentObject)
      } else {
        temp.push(currentObject)
      }
    }
    else if (Array.isArray(currentObject.epNumber) && data.length > 1) {
      if (currentObject.epNumber.split('-')[1] < numberOfEpisodes) {
        if (seen.size === seen.add(currentObject.epNumber).size) {
          filtered.push(currentObject)
        } else {
          temp.push(currentObject)
        }
      }
    }
    else {
      if (seen.size === seen.add(currentObject.epNumber).size) {
        filtered.push(currentObject)
      } else {
        temp.push(currentObject)
      }
    }
  });
  let unique = filtered
  unique = unique.filter((obj, pos, arr) => {
    return arr.map(mapObj => mapObj.epNumber).indexOf(obj.epNumber) === pos;
  });
  for (let object of unique) {
    let episodeNumber = object.epNumber;
    let uniqueTemp = temp.filter(f => {
      return f.epNumber === episodeNumber
    });
    let filteredEpisodes = filtered.filter(value => {
      return value.epNumber === episodeNumber
    })
    filteredEpisodes = uniqueTemp.concat(filteredEpisodes)
    filteredEpisodes = filteredEpisodes.reduce((prev, current) => {
      if (current.resolution.includes('p')) {
        return prev.resolution.slice(0, -1) > current.resolution.slice(0, -1) ? prev : current
      } else {
        return prev.resolution.split('x')[1] > current.resolution.split('x')[1] ? prev : current
      }
    })
    temp = temp.filter(value => {
      return value.epNumber != episodeNumber
    })
    temp = temp.concat(filteredEpisodes)
  }
  return temp
}

async function filter(arr, callback) {
  const fail = Symbol()
  return (await Promise.all(arr.map(async (item, index) => (await callback(item, index)) ? item : fail))).filter(i => i !== fail)
}

//Add all episodes returned from a particlar anime
const addEpisodes = async (req, res, next, db) => {
  try {
    let data = req.data;
    if (!data.length) {
      res.status(404)
      return next('No episodes found')
    }
    for (let episode of data) {
      if (episode.epNumber.includes('-')) {
        let episodeArray = episode.epNumber.split('-')
        for (let i = parseInt(episodeArray[0]); i < parseInt(episodeArray[1]) + 1; i++) {
          await db.query(`INSERT IGNORE INTO episodes2 (
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
        await db.query(`INSERT IGNORE INTO episodes2 (
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
    next();
  } catch (e) {
    res.status(500)
    next(e);
  }
}

//Error handler
const errorHandler = (err, req, res, next) => {
  const code = res.statusCode
  console.log(err)
  // if status 200 change to 500, otherwise get the defined status code
  res.status(code === 200 ? 500 : code)
  res.json({status: code, error: err});
}

//Require user to be authenticated
const requireAuthorisation = (req, res, next) => {
  if (req.header('Authorization') !== 'undefined' && req.header('Authorization') === process.env.ADMIN) {
    next();
  } else {
    res.status(401)
    next('Not Authorised');
  }
}

//Helper methods
const escapeProps = (obj) => {
  for (let key in obj) {
    if (Array.isArray(obj[key])) {
      for (let prop in obj[key]) {
        obj[key][prop].includes("'") ? obj[key][prop] = escapeString(obj[key][prop]) : '';
      }
    }
    obj[key].includes("'") ? obj[key] = escapeString(obj[key]) : '';
  }
  return obj;
}

const deleteUnusedProps = (obj) => {
  delete obj.score;
  delete obj.members;
  return obj;
}

const getNormalised = (obj) => {
  let combinedScore = obj.members * obj.score;
  let minimum = 40000 * 6.5;
  let maximum = 100000 * 6.5;
  let normalised = (combinedScore - minimum) / (maximum - minimum);
  return normalised;
}

const escapeString = (string) => {
  return string.replace(/'/g, "\''").replace(/"/g, "\"");
}


export {
  getAllAnime,
  getAllAnimeType,
  getAnime,
  getAiringAnime,
  getSeason,
  getSeasonLatest,
  getSeasonType,
  getEpisode,
  fetchEpisodes,
  getEpisodesAnime,
  addEpisode,
  addEpisodes,
  deleteEpisode,
  refreshSeason,
  updateSeason,
  updateSeasonType,
  requireAuthorisation,
  updateAnime,
  deleteAnime,
  addAnime,
  errorHandler
}