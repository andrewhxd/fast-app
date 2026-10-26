// Deploys the current build to a preview channel on the dev Firebase project (fast-app-cs499-dev),
// named after the git branch, e.g. https://fast-app-cs499-dev--andrew-sign-in-ab12cd34.web.app.
// `npm run deploy:branch` builds for the dev project first, then runs this.
// The channel expires after 7 days. It uses the dev project's database and rules, and never touches the
// live project or the main dev site.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
// Channel IDs are lowercase letters, numbers and hyphens, and "live" is the main site.
const channel = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
if (!channel || channel === 'live') {
  throw new Error(`Can't make a preview channel name from the branch "${branch}". Switch to a named branch.`);
}

// The Firebase CLI from this project's dev dependencies, run with this Node, so it works on every OS.
const firebase = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
execFileSync(process.execPath, [firebase, 'hosting:channel:deploy', channel, '--project', 'dev', '--expires', '7d'], {
  stdio: 'inherit',
});
