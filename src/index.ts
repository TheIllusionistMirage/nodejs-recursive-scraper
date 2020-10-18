import workerpool from 'workerpool';

import { dbConnectionPool, logger, logFilePath } from './globals';

// Initialize worker pool with child workers with a capacity of exactly five workers
const pool = workerpool.pool(`${__dirname}/scraperWorker.js`, {
  minWorkers: 5,
  maxWorkers: 5,
  workerType: 'process'
});

const url = 'https://medium.com';
const domain = 'https://medium.com';

logger.info(`Starting scraper, URL to scrape: ${url}, domain: ${domain}`);
pool.exec('scraperAction', [url, domain])
  .then(result => {
    logger.info(`Done scraping: ${url}, domain: ${domain}`);

    dbConnectionPool.end((err) => {
      logger.info('Database connection pool closed');
    });

    pool.terminate();
    logger.info('Scraper worker pool closed');
  })
  .catch(err => {
    logger.error(`Error(s) occurred while trying to scrape ${url}:`);
    logger.error(JSON.stringify(err));
  });

logger.info(`Started scraper asynchronously, all logs are being logged to: ${logFilePath} in addition to STDOUT`);
