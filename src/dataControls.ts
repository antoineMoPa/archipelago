import { parseArchitecture, type Architecture } from "./architecture";
import { ANALYSIS_PROMPT } from "./prompt";

const FEEDBACK_MS = 1600;

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`index.html is missing #${id}`);
  }
  return element as T;
}

function flash(button: HTMLButtonElement, text: string): void {
  const original = button.dataset.label ?? button.textContent ?? "";
  button.dataset.label = original;
  button.textContent = text;
  window.setTimeout(() => (button.textContent = original), FEEDBACK_MS);
}

export type DataControls = {
  reopenWithError: (json: string, message: string) => void;
};

export function setupDataControls(params: {
  onLoadPasted: (architecture: Architecture, json: string) => void;
  onShowExample: () => void;
}): DataControls {
  const { onLoadPasted, onShowExample } = params;
  const dialog = requireElement<HTMLDialogElement>("paste-dialog");
  const textarea = requireElement<HTMLTextAreaElement>("paste-json");
  const error = requireElement<HTMLElement>("paste-error");
  const fileInput = requireElement<HTMLInputElement>("paste-file");

  requireElement<HTMLButtonElement>("open-paste").addEventListener("click", () => {
    error.textContent = "";
    dialog.showModal();
    textarea.focus();
  });
  requireElement<HTMLButtonElement>("paste-cancel").addEventListener("click", () => dialog.close());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) {
      textarea.value = await file.text();
      fileInput.value = "";
    }
  });

  requireElement<HTMLFormElement>("paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const architecture = parseArchitecture(JSON.parse(textarea.value));
      dialog.close();
      onLoadPasted(architecture, textarea.value);
    } catch (parseError) {
      error.textContent = parseError instanceof Error ? parseError.message : String(parseError);
    }
  });

  const copyButton = requireElement<HTMLButtonElement>("copy-prompt");
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(ANALYSIS_PROMPT);
    flash(copyButton, "Copied");
  });

  requireElement<HTMLButtonElement>("show-example").addEventListener("click", onShowExample);

  return {
    reopenWithError: (json, message) => {
      textarea.value = json;
      error.textContent = message;
      dialog.showModal();
    },
  };
}
