import mysql from 'promise-mysql'

export default new Promise(async (resolve, reject) => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: 'blah'
    })
    initialiseTables(db) // Create tables in database
    resolve(db)
  } catch (e) {
    reject(e)
  }
})

const initialiseTables = async (db) => {
  try {
    // Anime table
    await db.query(`
    CREATE TABLE if not exists anime (
      malID INT PRIMARY KEY NOT NULL,
      type VARCHAR(10),
      picture TEXT,
      synopsis TEXT,
      licensor VARCHAR(100),
      title VARCHAR(255),
      link TEXT,
      genres TEXT,
      producers VARCHAR(100),
      fromType VARCHAR(50),
      nbEp INT,
      releaseDate int
    );`)
    // Episodes table
    await db.query(`
    CREATE TABLE if not exists episodes (
      malID int NOT NULL,
      FOREIGN KEY (malID) REFERENCES anime(malID),
      epNumber VARCHAR(20),
      PRIMARY KEY (malID, epNumber),
      category VARCHAR(10),
      resolution VARCHAR(20),
      aired INT,
      link TEXT,
      torrent TEXT,
      magnet TEXT
    );`)
  } catch (e) {
    console.log(e)
  }
}
