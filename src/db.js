import mysql from 'promise-mysql';

export default () => {
  mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  }).then(db => {
    return db;
  }).catch(e => console.log(e))
}