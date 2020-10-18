import { Logger } from 'tslog';
import mysql from 'mysql';

// This abstraction provides a CRUD-like API to
// manipulate the database that stores the
// scraped results.
// NOTE: This is not the most efficient
// implementation, and definitely not
// suitable for a production use case
export class DataStore {
    private logger: Logger;
    private pool: mysql.Pool;

    constructor(pool: mysql.Pool, logger: Logger) {
        this.pool = pool;
        this.logger = logger;

        // Delete all records from all previous runs (if there were any)
        this.pool.query('DELETE FROM scraped_results_table');
    }

    containsEntry(url: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.pool.query(`SELECT URL FROM scraped_results_table WHERE URL = \'${url}\'`, (error, results, fields) => {
                if (error) {
                    return reject(error);
                }

                return resolve(results[0] !== undefined && results[0].URL === url);
            });
        });
    }

    createEntry(url: string, referenceCount: number, params: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pool.query('INSERT INTO `scraped_results_table` (`URL`, `REFERENCE_COUNT`, `PARAMETERS`) VALUES (\'' + url + '\', \'' + referenceCount + '\', \'' + params.toString()  + '\')',
                (error, results, fields) => {
                if (error) {
                    this.logger.error('Failed to run the query:', 'INSERT INTO `scraped_results_table` (`URL`, `REFERENCE_COUNT`, `PARAMETERS`) VALUES (\'' + url + '\', \'' + referenceCount + '\', \'' + params.toString()  + '\')');
                    reject(error);
                }

                resolve();
            });
        });
    }

    updateEntry(url: string, referenceCount: number, params: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pool.query('UPDATE `scraped_results_table` SET `URL` = \'' + url + '\', `REFERENCE_COUNT` = \'' + referenceCount + '\', `PARAMETERS` = \'' + params.toString() + '\' WHERE `URL` = \'' + url + '\'', (error, results, fields) => {
                if (error) {
                    reject(error);
                }

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

                return resolve([results[0].REFERENCE_COUNT, results[0].PARAMETERS.split(',')]);
            });
        });
    }
}