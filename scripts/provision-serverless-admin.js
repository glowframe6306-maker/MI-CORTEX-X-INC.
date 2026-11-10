'use strict';

const crypto = require('node:crypto');
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../serverless/database');

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function promptLine(terminal, label) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      terminal.off('SIGINT', onInterrupt);
      terminal.off('close', onClose);
      terminal.input.off('error', onError);
    };
    const finish = (error, value) => {
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const onInterrupt = () => finish(new Error('Administrator setup cancelled.'));
    const onClose = () => finish(new Error('Terminal input closed during administrator setup.'));
    const onError = () => finish(new Error('Terminal input failed.'));
    terminal.once('SIGINT', onInterrupt);
    terminal.once('close', onClose);
    terminal.input.once('error', onError);
    try {
      terminal.question(label, (answer) => finish(null, answer));
    } catch {
      finish(new Error('Could not read terminal input.'));
    }
  });
}

function promptSecret(label) {
  const input = process.stdin;
  readline.emitKeypressEvents(input);
  return new Promise((resolve, reject) => {
    let value = '';
    let settled = false;
    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.off('error', onError);
      input.off('close', onClose);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        input.setRawMode(false);
      } catch (resetError) {
        if (!error) error = resetError;
      }
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === 'c') {
        finish(new Error('Administrator setup cancelled.'));
      } else if (key?.name === 'return' || key?.name === 'enter') {
        finish();
      } else if (key?.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
      } else if (typeof character === 'string' && character && !key?.ctrl && !key?.meta) {
        value += character;
      }
    };
    const onError = () => finish(new Error('Terminal input failed.'));
    const onClose = () => finish(new Error('Terminal input closed during administrator setup.'));
    input.on('keypress', onKeypress);
    input.once('error', onError);
    input.once('close', onClose);
    try {
      input.setRawMode(true);
      input.resume();
      process.stdout.write(label);
    } catch {
      finish(new Error('Could not enable hidden password input. Use an interactive PowerShell or terminal.'));
    }
  });
}

async function promptPassword() {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run the provisioning command in an interactive PowerShell or terminal so passwords remain hidden.');
  }
  const password = await promptSecret('Password (hidden): ');
  if (typeof password !== 'string' || password.length === 0) throw new Error('A password is required.');
  if (password.length < 14 || password.length > 1024) {
    throw new Error('Password must contain 14 to 1,024 characters.');
  }
  const confirmation = await promptSecret('Confirm password (hidden): ');
  if (typeof confirmation !== 'string' || confirmation.length === 0) {
    throw new Error('Password confirmation is required.');
  }
  if (password !== confirmation) throw new Error('The passwords do not match.');
  return password;
}

async function provisionSiteAdmin(database, username, password) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    throw new Error('CEO username must contain 3 to 64 letters, numbers, dots, underscores or hyphens.');
  }
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) {
    throw new Error('Password must contain 14 to 1,024 characters.');
  }
  const count = await database.query('SELECT COUNT(*)::integer AS count FROM site_admins');
  if (count.rows[0].count > 0) throw new Error('A CEO administrator already exists; provisioning will not overwrite it.');
  await database.query(
    "INSERT INTO site_admins (username, password_hash, role) VALUES ($1, $2, 'CEO')",
    [username, await bcrypt.hash(password, 12)]
  );
}

async function provisionCareersAdmin(database, email, password) {
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error('Enter a valid Careers administrator email address.');
  }
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) {
    throw new Error('Password must contain 14 to 1,024 characters.');
  }
  const count = await database.query('SELECT COUNT(*)::integer AS count FROM admins');
  if (count.rows[0].count > 0) throw new Error('A Careers administrator already exists; provisioning will not overwrite it.');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  await database.query(
    'INSERT INTO admins (email, password_salt, password_hash) VALUES ($1, $2, $3)',
    [email, salt.toString('hex'), hash.toString('hex')]
  );
}

async function main() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run the provisioning command in an interactive PowerShell or terminal.');
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  let accountType;
  let identity;
  try {
    accountType = (await promptLine(terminal, 'Account type (CEO or Careers): ')).trim().toLowerCase();
    if (!['ceo', 'careers'].includes(accountType)) throw new Error('Choose CEO or Careers.');
    identity = (await promptLine(terminal, accountType === 'ceo' ? 'CEO username: ' : 'Careers administrator email: ')).trim();
  } finally {
    terminal.close();
  }
  if (accountType === 'ceo' && !USERNAME_PATTERN.test(identity)) {
    throw new Error('CEO username must contain 3 to 64 letters, numbers, dots, underscores or hyphens.');
  }
  if (accountType === 'careers' && (!EMAIL_PATTERN.test(identity) || identity.length > 254)) {
    throw new Error('Enter a valid Careers administrator email address.');
  }
  const password = await promptPassword();
  const database = getDatabase();
  try {
    if (accountType === 'ceo') await provisionSiteAdmin(database, identity.toLowerCase(), password);
    else await provisionCareersAdmin(database, identity.toLowerCase(), password);
  } finally {
    await database.end();
  }
  console.log(`${accountType === 'ceo' ? 'CEO' : 'Careers'} administrator initialized for ${identity.toLowerCase()}.`);
}

if (require.main === module) {
  main().catch((error) => {
    const message = error.message || 'Administrator setup failed.';
    console.error(`Serverless administrator setup failed: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = { provisionCareersAdmin, provisionSiteAdmin };
