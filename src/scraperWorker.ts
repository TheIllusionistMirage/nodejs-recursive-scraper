import axios, { AxiosResponse } from 'axios';
import cheerio from 'cheerio';
import workerpool from 'workerpool';

import { logger, dataStore } from './globals';


const scraperAction = async (url: string, domain: string = 'https://medium.com') => {
    // Fetch the HTML code for the webpage pointed to by <url>
    let response: AxiosResponse<any>;

    try {
        response = await axios.get(url);
    } catch (error) {
        // If we get either of the following we totally ignore them
        // (in a production case, we would have retry logic or handle
        // this exception to act according to business requirements)
        logger.warn(`Got a 401, or 404, or 429 while trying to GET URL: ${url}, ignoring and NOT RETRYING`);
        return;
    }

    // Control reaches here means, GET succeeded with 200

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

    for (const urlLink of urlsFound) {
        logger.debug('Handling url:', urlLink);

        const urlComponents = urlLink.split('?');
        const urlWithPath = urlComponents[0]; // The substring BEFORE the '?' is the URL path
        const parametersAndValues = urlComponents[1]; // The substring AFTER the '?' contains the parameters (and their values)
        const params = new Array<string>();

        // In the following blocks, we populate/update the DB with
        // the parameter and reference count info for the URLs found
        // on this page.
        // Note: The process of looking up existing URLs in the DB
        // and updating the DB is not the most efficient. This will
        // need more optimization if considering a production use case.

        // If it is the first time we are encountering
        // this URL, we add it to the scraper results DB
        if (!(await dataStore.containsEntry(urlWithPath))) {
            if (parametersAndValues) {
                parametersAndValues.split('&').forEach(paramValuePair => params.push(paramValuePair.split('=')[0]));
            }

            // We actually test if record exists again since multiple
            // workers are updating the DB, and there's a fair chance
            // that we might end up attempting to insert the same
            // URL more than once.
            // Again, for a production use case, there needs to be
            // better and more comprehensive checks
            await dataStore.createOrUpdateEntry(urlWithPath, 1, params);

            urlsToScrape.push(urlLink);

            await scraperAction(urlLink).catch(err => {
                logger.error(`Error(s) occurred while trying to scrape ${urlLink}}, NOT RETRYING: ${err.message}`);
            });
        }
        // If we have already encountered this URL before, increment
        // the reference count of the URL also add any new parameters
        // that might have been present in this particular occurence
        // of the URL
        else {
            const [referenceCount, existingParams] = await dataStore.getReferenceCountAndParameters(urlWithPath);

            if (!existingParams) {
                const message = `Database in an inconsistent state for URL: ${urlWithPath}`;
                logger.error(message);
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
                              logger.error(`Error(s) occurred while trying to scrape ${urlLink}}, NOT RETRYING: ${err.message}`);
                            });
                        }
                    }
                });
            }

            await dataStore.updateEntry(urlWithPath, referenceCount + 1, existingParams.concat(params)).catch(error => {
                logger.error(`Failed to update entry for URL: ${urlWithPath}, reference count: ${referenceCount} and parameters: ${params.toString()}`);
            });
        }
    }

    logger.debug('Found these new URLs to scrape:');
    logger.debug(urlsToScrape);
}

workerpool.worker({
    scraperAction
});
