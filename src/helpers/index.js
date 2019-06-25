// Helper methods
const escapeProps = (obj) => {
  for (let key in obj) {
    if (Array.isArray(obj[key])) {
      for (let prop in obj[key]) {
        obj[key][prop] = obj[key][prop].includes("'") ? escapeString(obj[key][prop]) : obj[key][prop]
      }
    }
    obj[key] = obj[key].includes("'") ? escapeString(obj[key]) : obj[key]
  }
  return obj
}

const deleteUnusedProps = (obj) => {
  delete obj.score
  delete obj.members
  return obj
}

const getNormalised = (obj) => {
  let combinedScore = obj.members * obj.score
  let minimum = 40000 * 6.5
  let maximum = 100000 * 6.5
  let normalised = (combinedScore - minimum) / (maximum - minimum)
  return normalised
}

const escapeString = (string) => {
  return string.replace(/'/g, "\\'").replace(/"/g, '"')
}

const isEmpty = (obj) => {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false
    }
  }
  return true
}

const findHighestEpisodes = (arr) => {
  const max = arr.reduce((prev, current) => {
    return (prev.epNumber.split('-')[1] > current.epNumber.split('-')[1]) ? prev : current
  })
  return max
}

const findHighestDownloads = (arr) => {
  const max = arr.reduce((r, n) => {
    return (!r) ? n.nbDownload : Math.max(r, n.nbDownload)
  }, [])
  let key
  for (key in arr) {
    if (parseInt(arr[key].nbDownload) === max) break
  }
  return key
}

const findMaxResolution = (arr) => {
  let highest
  highest = arr.reduce((prev, current) => {
    if (current.resolution.includes('p')) {
      return (parseInt(prev.resolution.split('x')[0]) > parseInt(current.resolution.split('x')[0])) ? prev : current
    } else {
      return (parseInt(prev.resolution.split('x')[0]) > parseInt(current.resolution.split('x')[0])) ? prev : current
    }
  })

  let key
  for (key in arr) {
    if (arr[key].name === highest.name && arr[key].epNumber === highest.epNumber) break
  }

  // I was drunk when writing this, maybe this works???
  if (parseInt(highest.seeders === 0) && key !== arr.length - 1) {
    findMaxResolution(arr.splice(key, 1))
  } else {
    return highest
  }
}

const compare = (a, b) => {
  a = a.epNumber.split('-')
  b = b.epNumber.split('-')
  if (parseInt(a[0]) < parseInt(b[0])) {
    return -1
  }
  if (parseInt(a[0]) > parseInt(b[0])) {
    return 1
  }
  return 0
}

async function filter (arr, callback) {
  const fail = Symbol('fail')
  return (await Promise.all(arr.map(async (item, index) => (await callback(item, index)) ? item : fail))).filter(i => i !== fail)
}

export {
  escapeProps,
  deleteUnusedProps,
  getNormalised,
  escapeString,
  isEmpty,
  compare,
  findHighestDownloads,
  findMaxResolution,
  findHighestEpisodes,
  filter
}
