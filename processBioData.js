import sqlite3 from 'sqlite3';
import { createObjectCsvWriter } from 'csv-writer';
const { Database } = sqlite3.verbose();
import { open } from 'sqlite';


//async function processBioData(dbPath, outputCsvPath) {
//    return new Promise((resolve, reject) => {
//        const db = new Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
//            if (err) {
//                reject(`Error opening database: ${err.message}`);
//                return;
//            }
//            console.log('Successfully opened the database.');
//        });
//
//        const writer = createObjectCsvWriter({
//            path: outputCsvPath,
//            header: [
//                { id: 'BIO', title: 'BIO' },
//                { id: 'PHASEANGLE', title: 'PHASEANGLE' }
//            ]
//        });
//
//        let records = [];
//        let currentBatch = 0;
//        const batchSize = 30;
//
//        db.all("SELECT message FROM messages WHERE json_extract(message, '$.sensor') = 'BioImpedanceData' ORDER BY json_extract(message, '$.Batch')", (err, rows) => {
//            if (err) {
//                reject(`Error fetching rows: ${err.message}`);
//                return;
//            }
//
//            rows.forEach(row => {
//                try {
//                    const message = JSON.parse(row.message);
//                    if (message.sensor === 'BioImpedanceData' && Array.isArray(message.data)) {
//                        const batchNumber = message.Batch;
//
//                        // Fill in missing batches with zeros
//                        while (currentBatch < batchNumber) {
//                            for (let i = 0; i < batchSize; i++) {
//                                records.push({ BIO: 0, PHASEANGLE: 0 });
//                            }
//                            currentBatch++;
//                        }
//
//                        // Add the actual data
//                        records = records.concat(message.data);
//                        currentBatch = batchNumber + 1;
//                    }
//                } catch (parseError) {
//                    console.error(`Error parsing row message: ${parseError.message}`);
//                    console.log('Problematic row message:', row.message);
//                }
//            });
//
//            writer.writeRecords(records)
//                .then(() => {
//                    console.log(`CSV file created at ${outputCsvPath}`);
//                    db.close();
//                    resolve();
//                })
//                .catch((writeErr) => {
//                    reject(`Error writing CSV: ${writeErr.message}`);
//                });
//        });
//    });
//}
//
//
//
//

//export async function processBioData(dbPath, outputCsvPath) {
//    return new Promise((resolve, reject) => {
//        const db = new Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
//            if (err) {
//                reject(`Error opening database: ${err.message}`);
//                return;
//            }
//            console.log('Successfully opened the database.');
//        });
//
//        const writer = createObjectCsvWriter({
//            path: outputCsvPath,
//            header: [
//                { id: 'BIO', title: 'BIO' },
//                { id: 'PHASEANGLE', title: 'PHASEANGLE' }
//            ]
//        });
//
//        let records = [];
//        let currentBatch = 0;
//        let batchSize;
//
//        // First, get the batch size from the first message
//        db.get("SELECT message FROM messages WHERE json_extract(message, '$.sensor') = 'BioImpedanceData' ORDER BY json_extract(message, '$.Batch') LIMIT 1", (err, row) => {
//            if (err) {
//                reject(`Error fetching first row: ${err.message}`);
//                return;
//            }
//
//            try {
//                const message = JSON.parse(row.message);
//                batchSize = message.data.length;
//                console.log(`Determined batch size: ${batchSize}`);
//
//                // Now process all rows
//                db.all("SELECT message FROM messages WHERE json_extract(message, '$.sensor') = 'BioImpedanceData' ORDER BY json_extract(message, '$.Batch')", (err, rows) => {
//                    if (err) {
//                        reject(`Error fetching rows: ${err.message}`);
//                        return;
//                    }
//
//                    rows.forEach(row => {
//                        try {
//                            const message = JSON.parse(row.message);
//                            if (message.sensor === 'BioImpedanceData' && Array.isArray(message.data)) {
//                                const batchNumber = message.Batch;
//                                // Fill in missing batches with zeros
//                                while (currentBatch < batchNumber) {
//                                    for (let i = 0; i < batchSize; i++) {
//                                        records.push({ BIO: 0, PHASEANGLE: 0 });
//                                    }
//                                    currentBatch++;
//                                }
//                                // Add the actual data
//                                records = records.concat(message.data);
//                                currentBatch = batchNumber + 1;
//                            }
//                        } catch (parseError) {
//                            console.error(`Error parsing row message: ${parseError.message}`);
//                            console.log('Problematic row message:', row.message);
//                        }
//                    });
//
//                    writer.writeRecords(records)
//                        .then(() => {
//                            console.log(`CSV file created at ${outputCsvPath}`);
//                            db.close();
//                            resolve();
//                        })
//                        .catch((writeErr) => {
//                            reject(`Error writing CSV: ${writeErr.message}`);
//                        });
//                });
//
//            } catch (parseError) {
//                reject(`Error parsing first message to determine batch size: ${parseError.message}`);
//            }
//        });
//    });
//}

// Usage
//processBioData('messages.db', 'data1.csv')
//    .then(() => console.log('Processing completed successfully'))
//    .catch((error) => console.error('Error:', error));
//
//
//
//


//    module.exports = { processBioData };
//
//
//
//
//


export async function processBioData(dbPath, outputCsvPath, sessionStart) {
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        const writer = createObjectCsvWriter({
            path: outputCsvPath,
            header: [
                { id: 'BIO', title: 'BIO' },
                { id: 'PHASEANGLE', title: 'PHASEANGLE' }
            ]
        });

        let records = [];
        let currentBatch = 0;
        let batchSize;

        // First, get the batch size from the first message of this session
        const firstRow = await db.get("SELECT message FROM messages WHERE json_extract(message, '$.sensor') = 'BioImpedanceData' AND timestamp >= ? ORDER BY json_extract(message, '$.Batch') LIMIT 1", sessionStart);

        if (!firstRow) {
            throw new Error('No BioImpedanceData found for this session');
        }

        const firstMessage = JSON.parse(firstRow.message);
        batchSize = firstMessage.data.length;
        console.log(`Determined batch size: ${batchSize}`);

        // Now process all rows from this session
        const rows = await db.all("SELECT message FROM messages WHERE json_extract(message, '$.sensor') = 'BioImpedanceData' AND timestamp >= ? ORDER BY json_extract(message, '$.Batch')", sessionStart);

        rows.forEach(row => {
            try {
                const message = JSON.parse(row.message);
                if (message.sensor === 'BioImpedanceData' && Array.isArray(message.data)) {
                    const batchNumber = message.Batch;
                    // Fill in missing batches with zeros
                    while (currentBatch < batchNumber) {
                        for (let i = 0; i < batchSize; i++) {
                            records.push({ BIO: 0, PHASEANGLE: 0 });
                        }
                        currentBatch++;
                    }
                    // Add the actual data
                    records = records.concat(message.data);
                    currentBatch = batchNumber + 1;
                }
            } catch (parseError) {
                console.error(`Error parsing row message: ${parseError.message}`);
                console.log('Problematic row message:', row.message);
            }
        });

        await writer.writeRecords(records);
        console.log(`CSV file created at ${outputCsvPath}`);
        await db.close();

    } catch (error) {
        console.error('Error in processBioData:', error);
        throw error;
    }
}
