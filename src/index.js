import 'dotenv/config';
import cors from 'cors';
import morgan from 'morgan';
import express from 'express';
import mysql from 'promise-mysql';
import api from './api'
import { errorHandler } from './middleware';

const app = express();

// logger
app.use(morgan('dev'));
app.use(cors());

//Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}).then(db => {
  //Main api route
  app.use('/api', api(db));

  //Error handler middlware
  app.use(errorHandler)

  app.listen(process.env.PORT, () =>
    console.log(`Started on port ${process.env.PORT}`),
  );
}).catch(e => console.log(e));