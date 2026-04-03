import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface QuizArgs {
  title: string;
  language: string;
  questions: Array<{
    prompt: string;
    options: string[];
  }>;
}

interface QuizState {
  currentIndex: number;
  choices: Record<number, string>;
  resultsSent?: boolean;
}

export function renderQuiz(container: HTMLElement, args: QuizArgs, app: App): void {
  const { title, questions } = args;
  if (!questions?.length) {
    container.innerHTML = `<div class="ll-empty">No questions provided</div>`;
    return;
  }

  const saved = loadWidgetState<QuizState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let choices: Record<number, string> = saved?.choices ?? {};
  let resultsSent = saved?.resultsSent ?? false;
  let selected: string | null = null;

  function save() {
    saveWidgetState<QuizState>({ currentIndex, choices, resultsSent });
  }

  function draw() {
    if (currentIndex >= questions.length) {
      drawComplete();
      return;
    }

    const q = questions[currentIndex];
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${questions.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / questions.length) * 100}%"></div></div>
      <div class="quiz-prompt">${esc(q.prompt)}</div>
      <div class="quiz-options">
        ${q.options.map((opt) => `
          <button class="quiz-option${selected === opt ? " selected" : ""}" data-option="${escAttr(opt)}">
            ${esc(opt)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function drawComplete() {
    const lines = questions.map((q, i) =>
      `${i + 1}. '${q.prompt}' -> User chose: '${choices[i] || "skipped"}'`
    );
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Quiz complete!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Quiz responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  draw();

  container.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-option]") as HTMLElement | null;
    if (!btn?.dataset.option || selected) return;

    selected = btn.dataset.option;
    draw();

    setTimeout(() => {
      choices[currentIndex] = selected!;
      currentIndex++;
      selected = null;
      save();
      draw();
    }, 400);
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
