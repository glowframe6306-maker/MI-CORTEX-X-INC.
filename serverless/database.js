'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('@neondatabase/serverless');

let sharedPool;

function getDatabaseUrlState() {
  const value = process.env.DATABASE_URL;
  if (value === undefined) return 'undefined';
  if (value === null || value === '') return 'empty';
  return 'present';
}

function getDatabaseErrorCategory(error) {
  if (!error) return 'unknown';
  if (error instanceof Error) {
    switch (error.name) {
      case 'TypeError': return 'type_error';
      case 'ReferenceError': return 'reference_error';
      case 'RangeError': return 'range_error';
      case 'SyntaxError': return 'syntax_error';
      case 'AggregateError': return 'aggregate_error';
      case 'TimeoutError': return 'timeout_error';
      default: return 'generic_error';
    }
  }
  if (typeof error === 'string') return 'string_error';
  return 'unknown_error';
}

function getSanitizedDatabaseError(error) {
  const knownClasses = new Set([
    'Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'AggregateError', 'TimeoutError'
  ]);
  const errorClass = error instanceof Error && knownClasses.has(error.name) ? error.name : 'Error';
  return { errorClass, errorCategory: getDatabaseErrorCategory(error) };
}

async function diagnoseDatabaseReadOnlyQuery({ poolFactory = (options) => new Pool(options) } = {}) {
  const diagnostic = {
    databaseUrlState: getDatabaseUrlState(),
    poolInitializationSucceeded: false,
    connectionSucceeded: false,
    readOnlyQuerySucceeded: false
  };
  let pool;
  let client;
  let failure;

  try {
    if (diagnostic.databaseUrlState !== 'present') throw new Error('DATABASE_URL is required.');
    pool = poolFactory({ connectionString: process.env.DATABASE_URL, max: 1 });
    diagnostic.poolInitializationSucceeded = true;
    client = await pool.connect();
    diagnostic.connectionSucceeded = true;
    await client.query('SELECT current_database(), current_user');
    diagnostic.readOnlyQuerySucceeded = true;
  } catch (error) {
    failure = error;
  } finally {
    if (client && typeof client.release === 'function') {
      try {
        client.release(failure);
      } catch (error) {
        failure ||= error;
      }
    }
    if (pool && typeof pool.end === 'function') {
      try {
        await pool.end();
      } catch (error) {
        failure ||= error;
      }
    }
  }

  if (failure) Object.assign(diagnostic, getSanitizedDatabaseError(failure));
  return diagnostic;
}

function getDatabase() {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === null || process.env.DATABASE_URL === '') {
    throw new Error('DATABASE_URL is required.');
  }
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return sharedPool;
}

async function applySchema(database) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await database.query(schema);
}

module.exports = {
  applySchema,
  getDatabase,
  getDatabaseUrlState,
  getDatabaseErrorCategory,
  diagnoseDatabaseReadOnlyQuery
};
