const fs = require('fs');
const path = require('path');

const CFG_PATH = path.join(__dirname, 'config.json');

function readConfig() {
  try {
    if (!fs.existsSync(CFG_PATH)) return {};
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const current = readConfig();
  const next = { ...current, ...patch, _updatedAt: new Date().toISOString() };
  fs.writeFileSync(CFG_PATH, JSON.stringify(next, null, 2));
  return next;
}

function appendEvent(lineObj) {
  const file = path.join(__dirname, 'edits.jsonl');
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...lineObj }) + '\n');
}

module.exports = { readConfig, writeConfig, appendEvent };
