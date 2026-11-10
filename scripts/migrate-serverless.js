'use strict';

const { applySchema, getDatabase } = require('../serverless/database');

async function main() {
  if (!process.argv.includes('--apply-schema')) {
    throw new Error('Review the serverless setup instructions, then rerun with --apply-schema to create/update schema only.');
  }
  const database = getDatabase();
  try {
    await applySchema(database);
    console.log('Serverless PostgreSQL schema applied. No applicant data was imported.');
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(`Serverless schema setup failed (${error.code || error.name || 'Error'}).`);
  process.exitCode = 1;
});
