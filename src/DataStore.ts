import { Logger } from 'tslog';
import mysql from 'mysql';

export class DataStore {
    private logger: Logger;
    private pool: mysql.Pool;

    constructor(pool: mysql.Pool) {
        this.logger = new Logger({
            minLevel: "debug"
        });
        this.pool = pool;
    }

    containsEntry(url: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.pool.query(`SELECT URL FROM scraped_results_table WHERE URL = \'${url}\'`, (error, results, fields) => {
                if (error) {
                    return reject(error);
                }
                this.logger.trace(`Checked existence for: ${url}, existence: ${results[0] !== undefined && results[0].URL === url}`);
                return resolve(results[0] !== undefined && results[0].URL === url);
            });
        });
    }

    createEntry(url: string, referenceCount: number, params: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pool.query('INSERT INTO `scraped_results_table` (`URL`, `REFERENCE_COUNT`, `PARAMETERS`) VALUES (\'' + url + '\', \'' + referenceCount + '\', \'' + params.toString()  + '\');',
                (error, results, fields) => {
                if (error) {
                    this.logger.error('Failed to run the query:', 'INSERT INTO `scraped_results_table` (`URL`, `REFERENCE_COUNT`, `PARAMETERS`) VALUES (\'' + url + '\', \'' + referenceCount + '\', \'' + params.toString()  + '\');');
                    reject(error);
                }
                this.logger.trace(`Created entry: ${url}, ${referenceCount}, ${params}`);
                resolve();
            });
        });
    }

    updateEntry(url: string, referenceCount: number, params: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pool.query('UPDATE `scraped_results_table` SET `URL` = \'' + url + '\', `REFERENCE_COUNT` = \'' + referenceCount + '\', `PARAMETERS` = \'' + params.toString() + '\' WHERE `URL` = \'' + url + '\';', (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                this.logger.trace(`Updated entry: ${url}, ${referenceCount}, ${params}`);
                resolve();
            });
        });
    }

    createOrUpdateEntry(url: string, referenceCount: number, params: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.containsEntry(url)
            .then(exists => {
                if (exists) {
                    this.getReferenceCountAndParameters(url)
                    .then(value => {
                        const existingReferenceCount = value[0];
                        this.updateEntry(url, existingReferenceCount + referenceCount, params)
                        .then(() => {
                            resolve();
                        });
                    })
                    .catch(error => {
                        reject(error);
                    });
                }
                else {
                    this.createEntry(url, referenceCount, params)
                    .then(() => {
                        resolve();
                    })
                    .catch(error => {
                        reject(error);
                    });
                }
            })
            .catch(error => {
                reject(error);
            });
        });
    }

    getReferenceCountAndParameters(url: string): Promise<[number, string[]]> {
        return new Promise((resolve, reject) => {
            this.pool.query(`SELECT REFERENCE_COUNT, PARAMETERS FROM scraped_results_table WHERE URL = \'${url}\'`, (error, results, fields) => {
                if (error) {
                    return reject(error);
                }
                if (results === undefined || results[0] === undefined) {
                    return reject([,]);
                }
                this.logger.trace(`Fetched reference count and params: ${results[0].REFERENCE_COUNT}, ${results[0].PARAMETERS}, for: ${url}`);
                return resolve([results[0].REFERENCE_COUNT, results[0].PARAMETERS.split(',')]);
            });
        });
    }
}