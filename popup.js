const inputEl = document.getElementById("input");
const outputEl = document.getElementById("output");
const fieldListEl = document.getElementById("fieldList");
const statusEl = document.getElementById("status");
const modeBadgeEl = document.getElementById("modeBadge");
const showStartEl = document.getElementById("showStart");
const showEndEl = document.getElementById("showEnd");
const maskCharEl = document.getElementById("maskChar");
const maskAllBtn = document.getElementById("maskAll");
const unmaskAllBtn = document.getElementById("unmaskAll");
const copyOutputBtn = document.getElementById("copyOutput");
const searchInputEl = document.getElementById("searchInput");
const searchMetaEl = document.getElementById("searchMeta");

const SENSITIVE_KEYWORDS = [
  "token",
  "authorization",
  "auth",
  "cookie",
  "session",
  "secret",
  "password",
  "passwd",
  "phone",
  "mobile",
  "email",
  "mail",
  "idcard",
  "id_card",
  "身份证",
  "name",
  "realname",
  "userid",
  "useridtype",
  "openid",
  "unionid",
  "accesskey",
  "apikey",
  "api_key"
];

let currentParsed = null;
let currentLeaves = [];
let currentTree = null;
let maskedPaths = new Set();

function clampNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, 20);
}

function getMaskConfig() {
  return {
    showStart: clampNumber(showStartEl.value, 3),
    showEnd: clampNumber(showEndEl.value, 2),
    maskChar: maskCharEl.value || "*"
  };
}

function getSearchQuery() {
  return searchInputEl.value.trim().toLowerCase();
}

function maskString(value, config) {
  const source = String(value);
  if (!source) {
    return source;
  }

  const showStart = Math.min(config.showStart, source.length);
  const showEnd = Math.min(config.showEnd, Math.max(source.length - showStart, 0));
  const middleLength = Math.max(source.length - showStart - showEnd, 0);

  if (middleLength <= 0) {
    return config.maskChar.repeat(Math.max(source.length, 1));
  }

  return source.slice(0, showStart) +
    config.maskChar.repeat(middleLength) +
    source.slice(source.length - showEnd);
}

function collectLeaves(node, path = "$") {
  if (node === null || typeof node !== "object") {
    return [{ path, value: node }];
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      return [{ path, value: [] }];
    }
    return node.flatMap((item, index) => collectLeaves(item, `${path}[${index}]`));
  }

  const entries = Object.entries(node);
  if (entries.length === 0) {
    return [{ path, value: {} }];
  }

  return entries.flatMap(([key, value]) => collectLeaves(value, `${path}.${key}`));
}

function isSensitiveLabel(label) {
  const normalized = String(label).toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function buildTree(node, path = "$", keyLabel = "$") {
  if (node === null || typeof node !== "object") {
    return {
      path,
      keyLabel,
      kind: "leaf",
      value: node,
      leafPaths: [path],
      searchableText: `${path} ${keyLabel}`.toLowerCase(),
      isSensitive: isSensitiveLabel(keyLabel)
    };
  }

  const entries = Array.isArray(node)
    ? node.map((value, index) => [`[${index}]`, value, `${path}[${index}]`])
    : Object.entries(node).map(([key, value]) => [key, value, `${path}.${key}`]);

  const children = entries.map(([label, value, childPath]) => buildTree(value, childPath, label));
  const leafPaths = children.flatMap((child) => child.leafPaths);
  const sensitiveHits = children.some((child) => child.isSensitive || child.hasSensitiveDescendant);

  return {
    path,
    keyLabel,
    kind: Array.isArray(node) ? "array" : "object",
    size: entries.length,
    children,
    leafPaths,
    searchableText: `${path} ${keyLabel}`.toLowerCase(),
    isSensitive: isSensitiveLabel(keyLabel),
    hasSensitiveDescendant: sensitiveHits
  };
}

function applyMask(node, path = "$", config = getMaskConfig()) {
  if (node === null) {
    return maskedPaths.has(path) ? maskString("null", config) : null;
  }

  if (typeof node === "string") {
    return maskedPaths.has(path) ? maskString(node, config) : node;
  }

  if (typeof node === "number" || typeof node === "boolean") {
    return maskedPaths.has(path) ? maskString(String(node), config) : node;
  }

  if (Array.isArray(node)) {
    return node.map((item, index) => applyMask(item, `${path}[${index}]`, config));
  }

  if (typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, applyMask(value, `${path}.${key}`, config)])
    );
  }

  return node;
}

function previewValue(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? "[array]" : "{object}";
  }
  return String(value);
}

function maskPlainText(text, config) {
  const lines = text.split(/\r?\n/);
  return lines.map((line) => {
    if (!line.trim()) {
      return line;
    }
    return maskString(line, config);
  }).join("\n");
}

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${tone}`.trim();
}

function updateSearchMeta(text) {
  searchMetaEl.textContent = text;
}

function getNodeMaskState(node) {
  const total = node.leafPaths.length;
  const masked = node.leafPaths.filter((path) => maskedPaths.has(path)).length;
  return {
    checked: total > 0 && masked === total,
    indeterminate: masked > 0 && masked < total
  };
}

function setMaskedForPaths(paths, checked) {
  if (checked) {
    paths.forEach((path) => maskedPaths.add(path));
    return;
  }
  paths.forEach((path) => maskedPaths.delete(path));
}

function createKey(text) {
  const code = document.createElement("code");
  code.className = "tree-key";
  code.textContent = text;
  code.title = text;
  return code;
}

function createSensitivePill() {
  const pill = document.createElement("span");
  pill.className = "sensitive-pill";
  pill.textContent = "敏感";
  return pill;
}

function nodeMatchesQuery(node, query) {
  if (!query) {
    return true;
  }

  if (node.searchableText.includes(query)) {
    return true;
  }

  if (!node.children) {
    return false;
  }

  return node.children.some((child) => nodeMatchesQuery(child, query));
}

function countVisibleLeaves(node, query) {
  if (!nodeMatchesQuery(node, query)) {
    return 0;
  }
  if (node.kind === "leaf") {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countVisibleLeaves(child, query), 0);
}

function createLeafNode(node) {
  const wrapper = document.createElement("label");
  wrapper.className = "tree-leaf";

  const spacer = document.createElement("span");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = maskedPaths.has(node.path);
  checkbox.addEventListener("change", () => {
    setMaskedForPaths([node.path], checkbox.checked);
    updateOutput();
  });

  const label = document.createElement("span");
  label.className = "tree-label";
  if (node.isSensitive) {
    label.classList.add("is-sensitive");
  }

  const key = createKey(node.keyLabel);
  label.append(key);
  if (node.isSensitive) {
    label.append(createSensitivePill());
  }

  const sample = document.createElement("span");
  sample.className = "sample";
  if (node.isSensitive) {
    sample.classList.add("is-sensitive");
  }
  sample.textContent = previewValue(node.value).slice(0, 40);
  sample.title = previewValue(node.value);

  wrapper.append(spacer, checkbox, label, sample);
  return wrapper;
}

function createBranchNode(node, query) {
  const details = document.createElement("details");
  details.className = "tree-node";
  details.open = true;

  const summary = document.createElement("summary");
  summary.className = "tree-summary";

  const caret = document.createElement("span");
  caret.className = "caret";
  caret.textContent = "▶";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const state = getNodeMaskState(node);
  checkbox.checked = state.checked;
  checkbox.indeterminate = state.indeterminate;
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  checkbox.addEventListener("change", () => {
    setMaskedForPaths(node.leafPaths, checkbox.checked);
    updateOutput();
  });

  const label = document.createElement("span");
  label.className = "tree-label";
  if (node.isSensitive || node.hasSensitiveDescendant) {
    label.classList.add("is-sensitive");
  }

  const key = createKey(node.keyLabel);
  const meta = document.createElement("span");
  meta.className = "tree-meta";
  meta.textContent = `${node.kind} · ${node.size}`;

  label.append(key, meta);
  if (node.isSensitive || node.hasSensitiveDescendant) {
    label.append(createSensitivePill());
  }

  const sample = document.createElement("span");
  sample.className = "sample";
  sample.textContent = `${countVisibleLeaves(node, query)} fields`;
  sample.title = `${countVisibleLeaves(node, query)} fields`;

  summary.append(caret, checkbox, label, sample);

  const children = document.createElement("div");
  children.className = "tree-children";
  node.children.forEach((child) => {
    const childNode = renderTreeNode(child, query);
    if (childNode) {
      children.appendChild(childNode);
    }
  });

  details.append(summary, children);
  return details;
}

function renderTreeNode(node, query) {
  if (!nodeMatchesQuery(node, query)) {
    return null;
  }

  if (node.kind === "leaf") {
    return createLeafNode(node);
  }
  return createBranchNode(node, query);
}

function renderFieldTree(tree) {
  const query = getSearchQuery();

  if (!tree || !tree.children || tree.children.length === 0) {
    fieldListEl.className = "field-tree empty";
    fieldListEl.textContent = "当前 JSON 没有可单独控制的字段。";
    updateSearchMeta("未搜索");
    return;
  }

  const visibleNodes = tree.children
    .map((child) => renderTreeNode(child, query))
    .filter(Boolean);

  if (!visibleNodes.length) {
    fieldListEl.className = "field-tree empty";
    fieldListEl.textContent = "没有匹配的字段，请换个关键词试试。";
    updateSearchMeta("0 个匹配");
    return;
  }

  fieldListEl.className = "field-tree";
  fieldListEl.replaceChildren(...visibleNodes);

  const visibleLeafCount = tree.children.reduce((sum, child) => sum + countVisibleLeaves(child, query), 0);
  updateSearchMeta(query ? `${visibleLeafCount} 个匹配` : "未搜索");
}

function resetEmptyState() {
  fieldListEl.className = "field-tree empty";
  fieldListEl.textContent = "JSON 解析成功后，会在这里显示可勾选的字段树。";
  modeBadgeEl.textContent = "等待输入";
  updateSearchMeta("未搜索");
  setStatus("未处理");
}

function updateOutput() {
  const raw = inputEl.value.trim();
  const config = getMaskConfig();

  if (!raw) {
    currentParsed = null;
    currentLeaves = [];
    currentTree = null;
    maskedPaths = new Set();
    outputEl.textContent = "";
    resetEmptyState();
    return;
  }

  try {
    currentParsed = JSON.parse(raw);
    currentLeaves = collectLeaves(currentParsed);
    currentTree = buildTree(currentParsed);

    if (maskedPaths.size === 0) {
      maskedPaths = new Set(currentLeaves.map((item) => item.path));
    } else {
      const validPaths = new Set(currentLeaves.map((item) => item.path));
      maskedPaths = new Set([...maskedPaths].filter((path) => validPaths.has(path)));
      if (maskedPaths.size === 0) {
        maskedPaths = new Set(currentLeaves.map((item) => item.path));
      }
    }

    renderFieldTree(currentTree);
    modeBadgeEl.textContent = "JSON 模式";
    outputEl.textContent = JSON.stringify(applyMask(currentParsed, "$", config), null, 2);
    setStatus(`已处理 ${currentLeaves.length} 个字段`, "ok");
  } catch {
    currentParsed = null;
    currentLeaves = [];
    currentTree = null;
    maskedPaths = new Set();
    fieldListEl.className = "field-tree empty";
    fieldListEl.textContent = "当前内容不是合法 JSON，已切换为纯文本整行打码。";
    modeBadgeEl.textContent = "纯文本模式";
    updateSearchMeta("纯文本模式");
    outputEl.textContent = maskPlainText(inputEl.value, config);
    setStatus("JSON 解析失败，已按纯文本处理", "warn");
  }
}

async function copyOutput() {
  if (!outputEl.textContent) {
    setStatus("没有可复制的结果", "warn");
    return;
  }

  try {
    await navigator.clipboard.writeText(outputEl.textContent);
    setStatus("结果已复制", "ok");
  } catch {
    setStatus("复制失败，请手动复制", "warn");
  }
}

function setAllMasked(checked) {
  if (!currentLeaves.length) {
    return;
  }
  maskedPaths = checked
    ? new Set(currentLeaves.map((item) => item.path))
    : new Set();
  updateOutput();
}

inputEl.addEventListener("input", updateOutput);
showStartEl.addEventListener("input", updateOutput);
showEndEl.addEventListener("input", updateOutput);
maskCharEl.addEventListener("input", updateOutput);
searchInputEl.addEventListener("input", () => {
  if (currentTree) {
    renderFieldTree(currentTree);
  } else {
    updateSearchMeta(searchInputEl.value.trim() ? "等待 JSON" : "未搜索");
  }
});
maskAllBtn.addEventListener("click", () => setAllMasked(true));
unmaskAllBtn.addEventListener("click", () => setAllMasked(false));
copyOutputBtn.addEventListener("click", copyOutput);

resetEmptyState();
