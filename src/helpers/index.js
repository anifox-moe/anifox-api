/* eslint-disable no-use-before-define */
import fs from 'fs'
import request from 'request'
import readLine from 'readline'
import stream from 'stream'
/* eslint-enable no-use-before-define */

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

/*
const checkUrl = (host, port) => {
  let endPoint = 'http://rumbley.me'

  var proxyRequest = request.defaults({
    proxy: 'http://' + host + ':' + port
  });

  proxyRequest(endPoint, (err, res) => {
    if(err) {
      throw err
    }
    else if(res.statusCode != 200) {
      return false
    }
    else {
      return true
    }
  })
}

const proxyChecker = () => {
  let proxies = []
  let counter = 0

  const fileStream = fs.createReadStream('proxies.txt');
  var outstream = new stream;

  const rl = readLine.createInterface(fileStream, outstream);

  rl.on('line', (line) => {
    if (!/^#/.exec(line)) {
      var elts = line.split(':');
      var host = elts[0];
      var port = elts[1];
      if (host && port) {
        checkUrl(host, port) ? proxies.push(line) : proxies
        counter++;
      }
    }
  })
  .on('close', () => {
    console.log(counter)
    console.log(proxies)
  });

  /*
  //Write file back to proxies once validated
  fs.writeFile('../../proxies.txt', proxies, 'utf8', (err) => {
    if (err) throw err
    console.log('Proxies updated')
  });
}
*/

export {
  escapeProps,
  deleteUnusedProps,
  getNormalised,
  escapeString
}
