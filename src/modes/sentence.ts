import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface SentenceArgs {
  title: string;
  language: string;
  exercises: Array<{
    shuffledWords: string[];
    translation: string;
    hint?: string;
  }>;
}

interface SentenceState {
  currentIndex: number;
  built: Record<number, string[]>;
  resultsSent?: boolean;
}

export function renderSentence(container: HTMLElement, args: SentenceArgs, app: App): void {
  const { title, exercises } = args;
  if (!exercises?.length) {
    container.innerHTML = `<div class="ll-empty">No exercises provided</div>`;
    return;
  }

  const saved = loadWidgetState<SentenceState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let built: Record<number, string[]> = saved?.built ?? {};
  let resultsSent = saved?.resultsSent ?? false;
  let currentBuilt: string[] = [];
  let currentPool: string[] = [];

  function initExercise() {
    const ex = exercises[currentIndex];
    if (!ex) return;
    currentBuilt = [];
    currentPool = [...ex.shuffledWords];
  }

  function save() {
    saveWidgetState<SentenceState>({ currentIndex, built, resultsSent });
  }

  function draw() {
    if (currentIndex >= exercises.length) {
      drawComplete();
      return;
    }

    const ex = exercises[currentIndex];
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${exercises.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / exercises.length) * 100}%"></div></div>
      <div class="sentence-translation">${esc(ex.translation)}</div>
      ${ex.hint ? `<div class="sentence-hint">${esc(ex.hint)}</div>` : ""}
      <div class="sentence-built" data-zone="built">
        ${currentBuilt.length
          ? currentBuilt.map((w, i) =>
              `<span class="sentence-tile placed" data-built-idx="${i}">${esc(w)}</span>`
            ).join("")
          : `<span class="sentence-placeholder">Tap words below to build your sentence</span>`
        }
      </div>
      <div class="sentence-pool" data-zone="pool">
        ${currentPool.map((w, i) =>
          `<span class="sentence-tile" data-pool-idx="${i}">${esc(w)}</span>`
        ).join("")}
      </div>
      <button class="ll-btn ll-btn-primary sentence-submit" data-action="submit" ${currentPool.length > 0 ? "disabled" : ""}>Submit</button>
    `;
  }

  function drawComplete() {
    const lines = exercises.map((ex, i) => {
      const userBuilt = built[i] || [];
      return [
        `${i + 1}. Translation: '${ex.translation}'`,
        `   Words given: [${ex.shuffledWords.join(", ")}]`,
        `   User built: '${userBuilt.join(" ")}'`,
      ].join("\n");
    });

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Sentence builder complete!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Sentence builder responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  initExercise();
  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Tap a word in the pool -> move to built
    const poolTile = target.closest("[data-pool-idx]") as HTMLElement | null;
    if (poolTile) {
      const idx = parseInt(poolTile.dataset.poolIdx!, 10);
      const word = currentPool[idx];
      currentPool.splice(idx, 1);
      currentBuilt.push(word);
      draw();
      return;
    }

    // Tap a word in built -> move back to pool
    const builtTile = target.closest("[data-built-idx]") as HTMLElement | null;
    if (builtTile) {
      const idx = parseInt(builtTile.dataset.builtIdx!, 10);
      const word = currentBuilt[idx];
      currentBuilt.splice(idx, 1);
      currentPool.push(word);
      draw();
      return;
    }

    // Submit
    if (target.closest("[data-action='submit']") && currentPool.length === 0) {
      built[currentIndex] = [...currentBuilt];
      currentIndex++;
      save();
      initExercise();
      draw();
    }
  });
}

function esc(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}
