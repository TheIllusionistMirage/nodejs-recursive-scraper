import mysql from 'mysql';
import { ILogObject, Logger } from 'tslog';
import { statSync, unlinkSync, appendFileSync } from 'fs';

import { DataStore } from './DataStore';

// Initialize logger
export const logFilePath = `${__dirname}/logs.txt`;

try {
    const stats = statSync(logFilePath);
    unlinkSync(logFilePath);
}
catch (err) {
    // do nothing
}

const logToFile = (logObject: ILogObject) => {
    appendFileSync(logFilePath, `${JSON.stringify(logObject)}\n`);
}

export const logger: Logger = new Logger(
    {
        minLevel: 'info',
        type: "pretty",
        exposeStack: false
    }
);

logger.attachTransport(
    {
        silly: logToFile,
        debug: logToFile,
        trace: logToFile,
        info: logToFile,
        warn: logToFile,
        error: logToFile,
        fatal: logToFile
    }
);

// Initialize database connection pool

export const dbConnectionPool = mysql.createPool({
    connectionLimit: 5,
    host: process.env.HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_USER_PASSWORD,
    database: process.env.DATABASE
});

// Initialize data store abstraction
export const dataStore = new DataStore(dbConnectionPool, logger);
