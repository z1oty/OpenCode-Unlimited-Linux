const { execFileSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { detectSchema, quoteIdent, findDatabase, findExe } = require("./oc-info.js");

function run(file, args) {
  try {
    return String(
      execFileSync(file, args, { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "ignore"] }) || "",
    ).trim();
  } catch (error) {
    return String((error && error.stdout) || "").trim();
  }
}

function cliModels() {
  const raw = run(findExe(), ["models"]);
  const rows = [];
  for (const line of raw.split("\n")) {
    const text = line.trim();
    const slash = text.indexOf("/");
    if (slash <= 0) continue;
    const providerID = text.slice(0, slash);
    const id = text.slice(slash + 1).split("#")[0].trim();
    if (!id || /\s/.test(id)) continue;
    rows.push({ providerID, id, name: id, free: /free/i.test(id), context: 0 });
  }
  return rows;
}

function apiModels() {
  const raw = run(findExe(), ["api", "get", "/api/model"]);
  const start = raw.indexOf("{");
  if (start < 0) return [];
  try {
    const parsed = JSON.parse(raw.slice(start));
    const list = Array.isArray(parsed.data) ? parsed.data : [];
    return list
      .filter((item) => item && item.providerID && (item.modelID || item.id))
      .map((item) => {
        const cost = Array.isArray(item.cost) ? item.cost[0] : null;
        return {
          providerID: String(item.providerID),
          id: String(item.modelID || item.id),
          name: String(item.name || item.modelID || item.id),
          free: Boolean(cost && Number(cost.input) === 0 && Number(cost.output) === 0),
          context: Number((item.limit && item.limit.context) || 0),
        };
      });
  } catch {
    return [];
  }
}

function credentialed(handle) {
  const ids = new Set(["opencode"]);
  if (!handle) return ids;
  for (const row of handle.prepare("select distinct integration_id from credential where active is null or active = 1").all()) {
    if (row.integration_id) ids.add(String(row.integration_id));
  }
  if (Number(handle.prepare("select count(*) c from account").get().c) > 0) ids.add("opencode");
  return ids;
}

function parseSpec(spec) {
  const text = String(spec || "").trim();
  if (!text) throw new Error("empty model spec");
  const hash = text.indexOf("#");
  const head = hash >= 0 ? text.slice(0, hash) : text;
  const variant = hash >= 0 ? text.slice(hash + 1).trim() : "";
  const slash = head.indexOf("/");
  if (slash <= 0 || slash === head.length - 1) {
    throw new Error("model spec must look like provider/model or provider/model#variant");
  }
  return { providerID: head.slice(0, slash), id: head.slice(slash + 1), variant };
}

function modelJson(parsed) {
  const out = { id: parsed.id, providerID: parsed.providerID };
  if (parsed.variant) out.variant = parsed.variant;
  return out;
}

function normalizeDirectory(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function resolveTarget(handle, schema, target) {
  const text = String(target || "").trim();
  if (!text) throw new Error("name a session id or a folder");
  if (text.startsWith("ses_")) return { kind: "session", ids: [text], directory: "" };
  const table = quoteIdent(schema.sessionTable);
  const select = ["id"];
  if (schema.directoryColumn) select.push(quoteIdent(schema.directoryColumn) + " as directory");
  const want = normalizeDirectory(text);
  const rows = handle
    .prepare("select " + select.join(", ") + " from " + table)
    .all()
    .filter((row) => {
      const value = normalizeDirectory(row.directory);
      return value === want || value.startsWith(want + "/");
    });
  if (!rows.length) throw new Error("no sessions for folder: " + text);
  return { kind: "folder", ids: rows.map((row) => String(row.id)), directory: text };
}

function listModels(handle) {
  let rows = apiModels();
  if (!rows.length) rows = cliModels();
  const ids = credentialed(handle);
  const byProvider = new Map();
  for (const row of rows) {
    if (!byProvider.has(row.providerID)) byProvider.set(row.providerID, []);
    byProvider.get(row.providerID).push(row);
  }
  const providers = [...byProvider.entries()]
    .filter(([providerID]) => ids.has(providerID))
    .map(([providerID, models]) => ({
      providerID,
      models: models
        .sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id))
        .map((model) => ({ id: model.id, name: model.name, free: model.free, context: model.context, output: 0, variant: [] })),
    }))
    .sort((a, b) => a.providerID.localeCompare(b.providerID));
  return { registry: "cli", auth: "db", providers };
}

function readModel(handle, schema, id) {
  const row = handle.prepare("select model from " + quoteIdent(schema.sessionTable) + " where id = ?").get(id);
  if (!row) throw new Error("session not found: " + id);
  try {
    return row.model ? JSON.parse(String(row.model)) : null;
  } catch {
    return { raw: String(row.model) };
  }
}

function writeModel(handle, schema, id, value) {
  const table = quoteIdent(schema.sessionTable);
  handle.exec("begin");
  try {
    handle.prepare("update " + table + " set model = ? where id = ?").run(JSON.stringify(value), id);
    handle.exec("commit");
  } catch (error) {
    try {
      handle.exec("rollback");
    } catch {
      void 0;
    }
    throw error;
  }
}

function setModel(handle, options) {
  const schema = detectSchema(handle, { deep: false });
  if (!schema.sessionTable) throw new Error("no session table");
  const parsed = parseSpec(options.spec);
  const registry = listModels(handle);
  const provider = registry.providers.find((item) => item.providerID === parsed.providerID);
  if (!provider) throw new Error("unknown provider or no credentials: " + parsed.providerID);
  const model = provider.models.find((item) => item.id === parsed.id);
  if (!model && !options.force) throw new Error("model not in registry: " + parsed.providerID + "/" + parsed.id);

  const value = modelJson(parsed);
  const target = resolveTarget(handle, schema, options.target);
  const changed = [];
  for (const id of target.ids) {
    const before = readModel(handle, schema, id);
    writeModel(handle, schema, id, value);
    changed.push({ id, before, after: value });
  }
  return {
    spec: parsed.providerID + "/" + parsed.id + (parsed.variant ? "#" + parsed.variant : ""),
    applied: value,
    kind: target.kind,
    directory: target.directory,
    changed,
  };
}

function main() {
  const [dbArg, action, a, b] = process.argv.slice(2);
  if (!action) {
    console.log(JSON.stringify({ error: "usage: model-switch.js <db|-> <list|get|set> [args]" }));
    process.exitCode = 2;
    return;
  }
  const dbPath = !dbArg || dbArg === "-" ? findDatabase() : dbArg;
  if (!dbPath) {
    console.log(JSON.stringify({ error: "no database found" }));
    process.exitCode = 1;
    return;
  }
  const handle = new DatabaseSync(dbPath);
  try {
    if (action === "list") {
      console.log(JSON.stringify(listModels(handle), null, 2));
      return;
    }
    const schema = detectSchema(handle, { deep: false });
    if (action === "get") {
      const target = resolveTarget(handle, schema, a);
      console.log(
        JSON.stringify(
          { kind: target.kind, directory: target.directory, sessions: target.ids.map((id) => ({ id, model: readModel(handle, schema, id) })) },
          null,
          2,
        ),
      );
      return;
    }
    if (action === "set") {
      if (!a || !b) throw new Error("set needs a target and a provider/model spec");
      console.log(JSON.stringify(setModel(handle, { target: a, spec: b, force: false }), null, 2));
      return;
    }
    console.log(JSON.stringify({ error: "unknown action: " + action }));
    process.exitCode = 2;
  } catch (error) {
    console.log(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
    process.exitCode = 1;
  } finally {
    handle.close();
  }
}

if (require.main === module) main();

module.exports = { parseSpec, modelJson, setModel, listModels, resolveTarget };
