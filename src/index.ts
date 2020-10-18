import { Logger } from "tslog";

import { dbConnectionPool } from './globals';

// import { workerPool } from './globals';
// import { scraperAction } from './scraperAction';

const log: Logger = new Logger();


const parentUrl = 'https://medium.com';

// scraperAction(workerPool, dataStore, parentUrl).catch(err => {
//   log.error(`Error(s) occurred while trying to scrape ${parentUrl}:`);
//   log.error(JSON.stringify(err));
// }).then(() => {
//   dbConnectionPool.end((err) => {
//     log.debug('Database connection pool closed');
//   });
// });

// workerPool.exec(scraperAction, [parentUrl]).catch(err => {
//   log.error(`Error(s) occurred while trying to scrape ${parentUrl}:`);
//   log.error(JSON.stringify(err));
// }).then(() => {
//   // dbConnectionPool.end((err) => {
//   //   log.debug('Database connection pool closed');
//   // });
// });

import workerpool from 'workerpool';

const pool = workerpool.pool(__dirname + '/scraperWorker.js', {
  minWorkers: 5,
  maxWorkers: 5,
  workerType: 'process'
});

// const startTime1 = new Date().getTime();

// Promise.all([
//   pool.exec('fibonacci', [45]),
//   pool.exec('fibonacci', [45]),
//   pool.exec('fibonacci', [45])
// ]).then((sums) => {
//   pool.terminate();

//   const endTime1 = new Date().getTime();
//   let timeDiff1 = endTime1 - startTime1;
//   timeDiff1 /= 1000;
//   const elapsedTime1 = Math.round(timeDiff1);

//   log.debug('Sums:', sums[0], sums[1], sums[2], 'Total time:', elapsedTime1, 'secs');
// });

pool.exec('scraperAction', [parentUrl])
.then(result => {
  log.info('Done scraping' + parentUrl);

  dbConnectionPool.end((err) => {
    log.debug('Database connection pool closed');
  });

  pool.terminate();
  log.debug('Scraper worker pool closed');
})
.catch(err => {
  log.error(`Error(s) occurred while trying to scrape ${parentUrl}:`);
  log.error(JSON.stringify(err));
});