import mysql from 'mysql';
import workerpool from 'workerpool';

import { DataStore } from './DataStore';

// TODO: Read them from env
export const dbConnectionPool = mysql.createPool({
    connectionLimit: 5,
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'scraped_results'
});

export const dataStore = new DataStore(dbConnectionPool);

// // Worker pool
// export const workerPool = workerpool.pool({
//     minWorkers: 5,
//     maxWorkers: 5,
//     workerType: 'process'
// });