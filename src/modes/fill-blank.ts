import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface FillBlankArgs {
  title: string;
  language: string;
  sentences: Array<{
    text: string;
    hint?: string;
    options?: string[][];
  }>;
}

interface FillBlankState {
  currentIndex: number;
  answers: Record<number, string[]>;
  resultsSent?: boolean;
}

export function renderFillBlank(container: HTMLElement, args: FillBlankArgs, app: App): void {
  const { title, sentences } = args;
  if (!sentences?.length) {
    container.innerHTML = `<div class="ll-empty">No sentences provided</div>`;
    return;
  }

  const saved = loadWidgetState<FillBlankState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let answers: Record<number, string[]> = saved?.answers ?? {};
  let resultsSent = saved?.resultsSent ?? false;
  let openDropdown: number | null = null;

  function save() {
    saveWidgetState<FillBlankState>({ currentIndex, answers, resultsSent });
  }

  function countBlanks(text: string): number {
    return (text.match(/___/g) || []).length;
  }

  function draw() {
    if (currentIndex >= sentences.length) {
      drawComplete();
      return;
    }

    const s = sentences[currentIndex];
    const blanks = countBlanks(s.text);
    const parts = s.text.split("___");
    const currentAnswers = answers[currentIndex] || [];

    let html = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${sentences.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / sentences.length) * 100}%"></div></div>
      <div class="fill-sentence">`;

    for (let i = 0; i < parts.length; i++) {
      html += `<span>${esc(parts[i])}</span>`;
      if (i < blanks) {
        const blankOptions = s.options?.[i];
        const chosen = currentAnswers[i] || "";

        if (blankOptions?.length) {
          // Dropdown blank
          const isOpen = openDropdown === i;
          html += `<span class="fill-select-wrapper">`;
          html += `<button class="fill-select${chosen ? " fill-select-chosen" : ""}" data-toggle-dropdown="${i}">`;
          html += chosen ? esc(chosen) : "...";
          html += `</button>`;
          if (isOpen) {
            html += `<div class="fill-dropdown">`;
            blankOptions.forEach((opt) => {
              html += `<button class="fill-dropdown-item${chosen === opt ? " active" : ""}" data-pick-option="${escAttr(opt)}" data-blank="${i}">${esc(opt)}</button>`;
            });
            html += `</div>`;
          }
          html += `</span>`;
        } else {
          // Text input blank
          html += `<input type="text" class="fill-input" data-blank="${i}" value="${escAttr(chosen)}" placeholder="..." autocomplete="off" autocorrect="off" spellcheck="false">`;
        }
      }
    }

    html += `</div>`;
    if (s.hint) {
      html += `<div class="fill-hint">${esc(s.hint)}</div>`;
    }
    html += `<button class="ll-btn ll-btn-primary fill-submit" data-action="submit">Submit</button>`;

    container.innerHTML = html;

    // Focus first empty text input
    if (openDropdown === null) {
      const emptyInput = container.querySelector<HTMLInputElement>(".fill-input:placeholder-shown");
      emptyInput?.focus();
    }
  }

  function drawComplete() {
    const lines = sentences.map((s, i) => {
      const userAnswers = answers[i] || [];
      let filled = s.text;
      userAnswers.forEach((a) => {
        filled = filled.replace("___", `[${a}]`);
      });
      return `${i + 1}. "${filled}"`;
    });

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Fill in the blank complete!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Fill in the blank responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Toggle dropdown
    const toggleBtn = target.closest("[data-toggle-dropdown]") as HTMLElement | null;
    if (toggleBtn) {
      const idx = parseInt(toggleBtn.dataset.toggleDropdown!, 10);
      openDropdown = openDropdown === idx ? null : idx;
      draw();
      return;
    }

    // Pick option from dropdown
    const pickBtn = target.closest("[data-pick-option]") as HTMLElement | null;
    if (pickBtn) {
      const blankIdx = parseInt(pickBtn.dataset.blank!, 10);
      const value = pickBtn.dataset.pickOption!;
      if (!answers[currentIndex]) answers[currentIndex] = [];
      answers[currentIndex][blankIdx] = value;
      openDropdown = null;
      save();
      draw();
      return;
    }

    // Close dropdown on outside click
    if (openDropdown !== null && !target.closest(".fill-select-wrapper")) {
      openDropdown = null;
      draw();
      return;
    }

    // Submit
    if (target.closest("[data-action='submit']")) {
      const s = sentences[currentIndex];
      const blanks = countBlanks(s.text);
      const values: string[] = [];
      let allFilled = true;

      for (let i = 0; i < blanks; i++) {
        if (s.options?.[i]?.length) {
          const val = answers[currentIndex]?.[i] || "";
          if (!val) allFilled = false;
          values.push(val);
        } else {
          const input = container.querySelector<HTMLInputElement>(`[data-blank="${i}"]`);
          const val = input?.value.trim() || "";
          if (!val) allFilled = false;
          values.push(val);
        }
      }

      if (!allFilled) return;
      answers[currentIndex] = values;
      currentIndex++;
      openDropdown = null;
      save();
      draw();
    }
  });

  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const submitBtn = container.querySelector("[data-action='submit']") as HTMLElement;
      submitBtn?.click();
    }
  });
}

function esc(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

function escAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
