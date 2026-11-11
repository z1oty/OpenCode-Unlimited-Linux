const { randomUUID, createHash, randomBytes } = require("node:crypto");
const { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { configFile, configDir, stateDir } = require("./paths.js");

const STATE_FILE = configFile("unlimited-identity.json");
const PROJECT_FILE = configFile("identity.json");
const SHIM_DIR = stateDir();
const SHIM_GUID_FILE = join(SHIM_DIR, "machine-guid.txt");

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function newGuid() {
  return randomUUID().toLowerCase();
}

function newProjectId(seed) {
  return createHash("sha256").update("project\u0000" + String(seed)).digest("hex").slice(0, 40);
}

function newSalt(seed) {
  return createHash("sha256").update("salt\u0000" + String(seed)).digest("hex").slice(0, 32);
}

function fingerprint(guid) {
  return createHash("sha256").update(String(guid)).digest("hex").slice(0, 16);
}

function load() {
  const state = readJson(STATE_FILE);
  if (!state) return null;
  let changed = false;
  if (!state.deviceId) {
    const shim = existsSync(SHIM_GUID_FILE) ? readFileSync(SHIM_GUID_FILE, "utf8").trim() : "";
    state.deviceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shim)
      ? shim.toLowerCase()
      : newGuid();
    changed = true;
  }
  // earlier builds only stored a project id; adopt it when the project file agrees
  const project = readJson(PROJECT_FILE);
  if (project && typeof project.projectId === "string" && /^[0-9a-f]{40}$/i.test(project.projectId)) {
    if (state.projectId !== project.projectId) {
      state.projectId = project.projectId.toLowerCase();
      changed = true;
    }
  } else if (!state.projectId) {
    state.projectId = newProjectId(state.deviceId);
    changed = true;
  }
  if (!Number.isFinite(Number(state.generation))) {
    state.generation = 0;
    changed = true;
  }
  if (!state.createdAt) {
    state.createdAt = state.rotatedAt || new Date().toISOString();
    changed = true;
  }
  if (!state.affinity || typeof state.affinity !== "object") {
    state.affinity = { enabled: true, salt: newSalt(state.deviceId) };
    changed = true;
  }
  if (changed) {
    save(state);
    saveProject(state);
  }
  return state;
}

function save(state) {
  writeJson(STATE_FILE, state);
  ensureDir(SHIM_DIR);
  writeFileSync(SHIM_GUID_FILE, state.deviceId + "\n", "utf8");
  return state;
}

function saveProject(state) {
  writeJson(PROJECT_FILE, {
    projectId: state.projectId,
    deviceIdFingerprint: fingerprint(state.deviceId),
    createdAt: state.createdAt,
    rotatedAt: state.rotatedAt,
  });
}

function show() {
  const state = load();
  if (!state) {
    return {
      exists: false,
      stateFile: STATE_FILE,
      projectFile: PROJECT_FILE,
      shimFile: SHIM_GUID_FILE,
      configDir: configDir(),
      hint: "run identity rotate to mint one",
    };
  }
  return {
    exists: true,
    stateFile: STATE_FILE,
    projectFile: PROJECT_FILE,
    shimFile: SHIM_GUID_FILE,
    configDir: configDir(),
    deviceId: state.deviceId,
    projectId: state.projectId || "",
    fingerprint: fingerprint(state.deviceId),
    generation: Number(state.generation || 0),
    createdAt: state.createdAt || "",
    rotatedAt: state.rotatedAt || "",
    affinity: state.affinity && state.affinity.enabled !== false,
    registryTouched: false,
  };
}

function rotate(options = {}) {
  const previous = load();
  const now = new Date().toISOString();
  const deviceId = options.deviceId || newGuid();
  const seed = deviceId + now + randomBytes(16).toString("hex");
  const state = {
    deviceId,
    projectId: newProjectId(seed),
    generation: previous ? Number(previous.generation || 0) + 1 : 1,
    createdAt: (previous && previous.createdAt) || now,
    rotatedAt: now,
    affinity: {
      enabled: previous && previous.affinity ? previous.affinity.enabled !== false : true,
      salt: newSalt(seed),
    },
    history: [
      ...((previous && Array.isArray(previous.history)) ? previous.history : []).slice(-19),
      previous && previous.deviceId ? { deviceId: previous.deviceId, projectId: previous.projectId || "", retiredAt: now } : null,
    ].filter(Boolean),
  };
  save(state);
  saveProject(state);
  return {
    deviceId,
    projectId: state.projectId,
    previous: previous ? previous.deviceId || "" : "",
    generation: state.generation,
    fingerprint: fingerprint(deviceId),
    stateFile: STATE_FILE,
    projectFile: PROJECT_FILE,
    shimFile: SHIM_GUID_FILE,
    registryTouched: false,
  };
}

function restore() {
  const state = load();
  if (!state) return { restored: false, reason: "no identity state" };
  for (const file of [SHIM_GUID_FILE, PROJECT_FILE]) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        void 0;
      }
    }
  }
  return { restored: true, removed: [SHIM_GUID_FILE, PROJECT_FILE], stateFile: STATE_FILE, registryTouched: false };
}

function main() {
  const [action, arg] = process.argv.slice(2);
  try {
    if (!action || action === "show") {
      console.log(JSON.stringify(show(), null, 2));
      return;
    }
    if (action === "rotate") {
      console.log(JSON.stringify(rotate({ deviceId: arg || "" }), null, 2));
      return;
    }
    if (action === "restore") {
      console.log(JSON.stringify(restore(), null, 2));
      return;
    }
    if (action === "fingerprint") {
      const state = load();
      console.log(JSON.stringify({ fingerprint: state ? fingerprint(state.deviceId) : "" }));
      return;
    }
    console.log(JSON.stringify({ error: "unknown action: " + action }));
    process.exitCode = 2;
  } catch (error) {
    console.log(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { show, rotate, restore, fingerprint, STATE_FILE, PROJECT_FILE, SHIM_DIR, SHIM_GUID_FILE };
