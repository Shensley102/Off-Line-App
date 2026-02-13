import { DEFAULT_STATE } from "./config.js";

const STORAGE_KEY = "aa95.state.v1";
const SELECTOR_KEY = "aa95.selector.v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function loadSelector() {
  try { return localStorage.getItem(SELECTOR_KEY) || "COM1"; } catch { return "COM1"; }
}

export function saveSelector(sel) {
  try { localStorage.setItem(SELECTOR_KEY, sel); } catch {}
}
