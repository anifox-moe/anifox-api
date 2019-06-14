import mysql from 'promise-mysql'

export default new Promise(async (resolve, reject) => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    })
    resolve(db)
  } catch(e) {
    reject(e)
  }
})
