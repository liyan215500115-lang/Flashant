#!/bin/bash
# Flashant Vercel deploy
# Usage: ./scripts/deploy.sh
set -e
cd "$(dirname "$0")/.."

echo "🚀 Deploying Flashant to Vercel..."

# Proxy: 127.0.0.1:7897 (Clash Verge / V2Ray / surge)
# If no proxy, remove the --require line below
NODE_SCRIPT=$(mktemp)
cat > "$NODE_SCRIPT" << 'NODEEOF'
const { HttpsProxyAgent } = require('./node_modules/https-proxy-agent/dist/index.js');
const proxy = new HttpsProxyAgent('http://127.0.0.1:7897');
require('http').globalAgent = proxy;
require('https').globalAgent = proxy;
process.env.HTTP_PROXY = 'http://127.0.0.1:7897';
process.env.HTTPS_PROXY = 'http://127.0.0.1:7897';

// Run vercel from npx cache or fall back to npx
const { execSync } = require('child_process');
const home = require('os').homedir();

// Find cached vercel installation
const fs = require('fs');
const npxDir = `${home}/.npm/_npx`;
let vercelBin = null;
if (fs.existsSync(npxDir)) {
  const dirs = fs.readdirSync(npxDir);
  for (const d of dirs) {
    const p = `${npxDir}/${d}/node_modules/.bin/vercel`;
    if (fs.existsSync(p)) { vercelBin = p; break; }
  }
}

const args = ['--cwd', process.cwd(), '--prod', '--yes'];
const cmd = vercelBin ? `"${vercelBin}" ${args.join(' ')}` : `npx vercel ${args.join(' ')}`;
try {
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 180000 });
  // Show key lines
  out.split('\n').filter(l => l.match(/Production|error|Ready|Deploying/i)).forEach(l => console.log(l));
} catch (e) {
  console.error(e.stdout || e.message);
  process.exit(1);
}
NODEEOF

node "$NODE_SCRIPT"
rm "$NODE_SCRIPT"
echo "✅ Done — https://flashant.vercel.app"
