const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const PROJECT_DIR = path.join(__dirname, '..');
const ALJEZUR_STAGE_COMMAND = 'cp -R aljezur _site/';
const DEPLOY_WORKFLOWS = [
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/refresh-calendars.yml'
];

for (const workflowPath of DEPLOY_WORKFLOWS) {
  test(`${path.basename(workflowPath)} stages Aljezur`, async () => {
    const workflow = await fs.readFile(path.join(PROJECT_DIR, workflowPath), 'utf8');

    assert.ok(workflow.includes(ALJEZUR_STAGE_COMMAND), `${workflowPath} omits Aljezur`);
  });
}
