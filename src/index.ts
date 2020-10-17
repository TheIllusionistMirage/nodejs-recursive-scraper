import { Logger } from "tslog";
import axios from 'axios';
import cheerio from 'cheerio';

import mysql from 'mysql';

import { DataStore } from './DataStore';

const log: Logger = new Logger();

// TODO: Read them from env
const pool = mysql.createPool({
  connectionLimit: 5,
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'scraped_results'
});

// const database: Map<string, string[]> = new Map<string, string[]>();
const dataStore = new DataStore(pool);

const scraperAction = async (url: string, domain: string = 'https://medium.com') => {

  log.info(`Scraping: ${url}...`);
  // Fetch the HTML code for the webpage pointed to by <url>
  const response = await axios.get(url);
  if (response.status !== 200) {
    const message = `Failed at GET-ing the HTML page for the URL: ${url}`;
    log.error(message);
    throw Error(message);
  }
  const body: string = response.data;

  // Get hold of all the <a> tags in the page
  const $ = cheerio.load(body);
  const hrefElements = $('a');

  // Get hold of all the URLs that are paths of <domain>

  // Flags to ascertain if we have reached one the base conditions:
  // * There are no URLs that are a part of <domain>
  // * There no new URLs that are a part of <domain> with UNIQUE parameters
  let newUrlsFound: boolean = false;
  let urlWithNewUniqueParams: boolean = false;

  // List of URLs that are a part of <domain> found on this page
  const urlsFound: string[] = new Array<string>();
  // List of URLs that we need to scrape further
  const urlsToScrape: string[] = [];

  hrefElements.each((_, link) => {

    // For each URL, check if it belongs to <domain>,
    // and if yes, add it to the database, if it does
    // not exist already
    const urlLink = link.attribs.href;

    if (urlLink.includes(domain)) {
      newUrlsFound = true;
      urlsFound.push(urlLink);
    }
  });

  // urlsFound.forEach(async (urlLink) => {
  for (const urlLink of urlsFound) {
    log.debug('Handling url:', urlLink);
    const urlComponents = urlLink.split('?');
    const urlWithPath = urlComponents[0]; // The substring BEFORE the '?' is the URL path
    const parametersAndValues = urlComponents[1]; // The substring AFTER the '?' contains the parameters (and their values)
    const params = new Array<string>();

    // const foo = await dataStore.containsEntry(urlWithPath)
    // log.debug('URL:', urlWithPath, ' existence:', foo);
    if (!(await dataStore.containsEntry(urlWithPath))) {
      if (parametersAndValues) {
        parametersAndValues.split('&').forEach(paramValuePair => params.push(paramValuePair.split('=')[0]));
      }

      await dataStore.createEntry(urlWithPath, 1, params).catch(error => {
        log.error(`Failed to insert entry for URL: ${urlWithPath}, reference count: 1 and parameters: ${params.toString()}`);
      });
      urlsToScrape.push(urlLink);

      // test
      // await scraperAction2(urlLink).catch(err => {
      //   log.error(`Error(s) occurred while trying to scrape ${urlLink}}:`);
      //   log.error(JSON.stringify(err));
      // });
    }
    else {
      const [referenceCount, existingParams] = await dataStore.getReferenceCountAndParameters(urlWithPath);

      if (!existingParams) {
        // Error
        const message = `Database in an inconsistent state for URL: ${urlWithPath}`;
        log.error(message);
        throw Error(message);
      }

      if (parametersAndValues) {
        parametersAndValues.split('&').forEach(async paramValuePair => {
          const param = paramValuePair.split('=')[0];

          if (!existingParams.includes(param)) {
            urlWithNewUniqueParams = true;
            params.push(param);

            if (!urlsToScrape.includes(urlLink)) {
              urlsToScrape.push(urlLink);

              // test
              // await scraperAction2(urlLink).catch(err => {
              //   log.error(`Error(s) occurred while trying to scrape ${urlLink}}:`);
              //   log.error(JSON.stringify(err));
              // });
            }
          }
        });
      }

      await dataStore.updateEntry(urlWithPath, referenceCount + 1, existingParams.concat(...params)).catch(error => {
        log.error(`Failed to update entry for URL: ${urlWithPath}, reference count: ${referenceCount} and parameters: ${params.toString()}`);
      });
    }
  }
  // });

  log.debug('Found these new URLs to scrape:');
  log.debug(urlsToScrape);

  for (const urlLink of urlsToScrape) {
    // test
    await scraperAction(urlLink).catch(err => {
      log.error(`Error(s) occurred while trying to scrape ${urlLink}}:`);
      log.error(JSON.stringify(err));
    });
  }

  // log.debug(`Database after scraping: ${url}`);
}

const url = 'https://medium.com';

scraperAction(url).catch(err => {
  log.error(`Error(s) occurred while trying to scrape ${url}:`);
  log.error(JSON.stringify(err));
}).then(() => {
  // database.forEach((params, url) => {
  //     log.debug('URL:', url, ', UNIQUE PARAMS:', JSON.stringify(params));
  // })
  pool.end((err) => {
    // all connections in the pool have ended
    log.debug('All connections closed');
  });
});
