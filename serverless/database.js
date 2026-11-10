'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('@neondatabase/serverless');

let sharedPool;

function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return sharedPool;
}

async function applySchema(database) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await database.query(schema);
}

module.exports = { applySchema, getDatabase };
