import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface ScrambleArgs {
  title: string;
  language: string;
  words: Array<{
    scrambled: string;
    hint?: string;
  }>;
}

interface ScrambleState {
  currentIndex: number;
  answers: Record<number, string>;
  resultsSent?: boolean;
}

export function renderScramble(container: HTMLElement, args: ScrambleArgs, app: App): void {
  const { title, words } = args;
  if (!words?.length) {
    container.innerHTML = `<div class="ll-empty">No words provided</div>`;
    return;
  }

  const saved = loadWidgetState<ScrambleState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let answers: Record<number, string> = saved?.answers ?? {};
  let resultsSent = saved?.resultsSent ?? false;

  let pool: string[] = [];
  let built: string[] = [];

  function initWord() {
    const w = words[currentIndex];
    if (!w) return;
    pool = w.scrambled.split("");
    built = [];
  }

  function save() {
    saveWidgetState<ScrambleState>({ currentIndex, answers, resultsSent });
  }

  function draw() {
    if (currentIndex >= words.length) {
      drawComplete();
      return;
    }

    const w = words[currentIndex];
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${words.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / words.length) * 100}%"></div></div>
      ${w.hint ? `<div class="scramble-hint">${esc(w.hint)}</div>` : ""}
      <div class="scramble-built" data-zone="built">
        ${built.length
          ? built.map((ch, i) =>
              `<span class="scramble-letter placed" data-built-idx="${i}">${esc(ch)}</span>`
            ).join("")
          : `<span class="sentence-placeholder">Tap letters to form the word</span>`
        }
      </div>
      <div class="scramble-pool" data-zone="pool">
        ${pool.map((ch, i) =>
          `<span class="scramble-letter" data-pool-idx="${i}">${esc(ch)}</span>`
        ).join("")}
      </div>
      <button class="ll-btn ll-btn-primary sentence-submit" data-action="submit" ${pool.length > 0 ? "disabled" : ""}>Submit</button>
    `;
  }

  function drawComplete() {
    const lines = words.map((w, i) =>
      `${i + 1}. Scrambled: '${w.scrambled}' -> User formed: '${answers[i] || ""}'`
    );

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Word scramble complete!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Word scramble responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  initWord();
  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const poolTile = target.closest("[data-pool-idx]") as HTMLElement | null;
    if (poolTile) {
      const idx = parseInt(poolTile.dataset.poolIdx!, 10);
      const ch = pool[idx];
      pool.splice(idx, 1);
      built.push(ch);
      draw();
      return;
    }

    const builtTile = target.closest("[data-built-idx]") as HTMLElement | null;
    if (builtTile) {
      const idx = parseInt(builtTile.dataset.builtIdx!, 10);
      const ch = built[idx];
      built.splice(idx, 1);
      pool.push(ch);
      draw();
      return;
    }

    if (target.closest("[data-action='submit']") && pool.length === 0) {
      answers[currentIndex] = built.join("");
      currentIndex++;
      save();
      initWord();
      draw();
    }
  });
}

function esc(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}
