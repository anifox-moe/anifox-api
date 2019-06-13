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
  escapeProps,
  deleteUnusedProps,
  getNormalised,
  escapeString
}