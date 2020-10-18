import { Logger } from "tslog";
import axios, { AxiosResponse } from 'axios';
import cheerio from 'cheerio';

import workerpool from 'workerpool';

import { dataStore } from './globals';

const log: Logger = new Logger({
    minLevel: "info"
});

const scraperAction = async (url: string, domain: string = 'https://medium.com') => {
    // log.info(`Scraping: ${url}...`);
    // Fetch the HTML code for the webpage pointed to by <url>
    let response: AxiosResponse<any>;

    try {
        response = await axios.get(url);
    } catch (error) {
        log.error(`Something went wrong while trying to scrape URL: ${url}, NOT RETRYING`);
        return;
    }

    // log.info('Response code:', response.status);
    if (response.status === 404) {
        log.error(`Received a 404, ignoring URL: ${url}`);
        return;
    }
    else if (response.status === 401) {
        log.error(`Received a 401, ignoring URL: ${url}`);
        // throw Error('Received a 429, retry period:' + JSON.stringify(response.headers));
        return;
    }
    else if (response.status === 429) {
        log.error(`Received a 429, ignoring URL: ${url}`);
        // throw Error('Received a 429, retry period:' + JSON.stringify(response.headers));
        return;
    }

    if (response.status !== 404 && response.status !== 401 && response.status !== 429 && response.status !== 200) {
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
        let urlLink = link.attribs.href;

        // Added
        if (urlLink[0] === '/') {
            urlLink = domain + urlLink;
        }

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

            // NOTE!!!!
            // Sometimes key already added by another instance so this fails!
            // Check if key exists and add it
            // await dataStore.createEntry(urlWithPath, 1, params).catch(error => {
            //     log.error(`Failed to insert entry for URL: ${urlWithPath}, reference count: 1 and parameters: ${params.toString()}`);
            // });

            await dataStore.createOrUpdateEntry(urlWithPath, 1, params);

            urlsToScrape.push(urlLink);

            // test
            await scraperAction(urlLink).catch(err => {
                log.error(`Error(s) occurred while trying to scrape ${urlLink}}, NOT RETRYING: ${err.message}`);
            });
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
                            await scraperAction(urlLink).catch(err => {
                              log.error(`Error(s) occurred while trying to scrape ${urlLink}}, NOT RETRYING: ${err.message}`);
                            });
                        }
                    }
                });
            }

            await dataStore.updateEntry(urlWithPath, referenceCount + 1, existingParams.concat(params)).catch(error => {
                log.error(`Failed to update entry for URL: ${urlWithPath}, reference count: ${referenceCount} and parameters: ${params.toString()}`);
            });
        }
    }
    // });

    log.debug('Found these new URLs to scrape:');
    log.debug(urlsToScrape);

    // for (const urlLink of urlsToScrape) {
    //     // test
    //     await scraperAction(dataStore, urlLink).catch(err => {
    //         log.error(`Error(s) occurred while trying to scrape ${urlLink}}:`);
    //         log.error(JSON.stringify(err));
    //     });
    // }
    // urlsToScrape.forEach(urlLink => {
    //     // test
    //     workerPool.exec(scraperAction, [urlLink]).catch(err => {
    //         log.error(`Error(s) occurred while trying to scrape ${urlLink}}:`);
    //         log.error(JSON.stringify(err));
    //     });
    // });
}

workerpool.worker({
    scraperAction
});
