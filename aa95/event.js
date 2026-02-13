export function emit(detail) {
  window.dispatchEvent(new CustomEvent("panel:change", { detail }));
}
