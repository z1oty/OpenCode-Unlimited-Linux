const { homedir } = require("node:os");
const { join } = require("node:path");

function homeDir() {
  return process.env.HOME || homedir();
}

function configDir() {
  const explicit = process.env.OPENCODE_CONFIG_HOME || process.env.OPENCODE_CONFIG_DIR;
  if (explicit) return explicit;
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "opencode");
  return join(homeDir(), ".config", "opencode");
}

function dataDir() {
  const explicit = process.env.OPENCODE_DATA_HOME || process.env.OPENCODE_DATA_DIR;
  if (explicit) return explicit;
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, "opencode");
  return join(homeDir(), ".local", "share", "opencode");
}

function stateDir() {
  const xdg = process.env.XDG_STATE_HOME;
  if (xdg) return join(xdg, "opencode-unlimited");
  return join(homeDir(), ".local", "state", "opencode-unlimited");
}

function configFile(name) {
  return join(configDir(), name);
}

module.exports = { homeDir, configDir, dataDir, stateDir, configFile };
