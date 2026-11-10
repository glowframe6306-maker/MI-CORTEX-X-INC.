import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createServerlessHandler } = require('../serverless/handler');

const handler = createServerlessHandler({
  pages: {
    login: fs.readFileSync(path.join(process.cwd(), 'admin-login.html'), 'utf8'),
    dashboard: fs.readFileSync(path.join(process.cwd(), 'admin.html'), 'utf8')
  }
});

export default { fetch: handler };
