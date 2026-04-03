import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface FillBlankArgs {
  title: string;
  language: string;
  sentences: Array<{
    text: string;
    hint?: string;
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
        html += `<input type="text" class="fill-input" data-blank="${i}" placeholder="..." autocomplete="off" autocorrect="off" spellcheck="false">`;
      }
    }

    html += `</div>`;
    if (s.hint) {
      html += `<div class="fill-hint">${esc(s.hint)}</div>`;
    }
    html += `<button class="ll-btn ll-btn-primary fill-submit" data-action="submit">Submit</button>`;

    container.innerHTML = html;

    const firstInput = container.querySelector("[data-blank='0']") as HTMLInputElement;
    firstInput?.focus();
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

    if (target.closest("[data-action='submit']")) {
      const inputs = container.querySelectorAll<HTMLInputElement>(".fill-input");
      const values: string[] = [];
      let allFilled = true;
      inputs.forEach((inp) => {
        const v = inp.value.trim();
        if (!v) allFilled = false;
        values.push(v);
      });
      if (!allFilled) return;
      answers[currentIndex] = values;
      currentIndex++;
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
