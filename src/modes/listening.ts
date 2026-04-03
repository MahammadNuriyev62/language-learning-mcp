import type { App } from "@modelcontextprotocol/ext-apps";
import { speak } from "../speech";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface ListeningArgs {
  title: string;
  language: string;
  words: Array<{
    word: string;
    hint?: string;
  }>;
}

interface ListeningState {
  currentIndex: number;
  typed: Record<number, string>;
}

export function renderListening(container: HTMLElement, args: ListeningArgs, app: App): void {
  const { title, words } = args;
  if (!words?.length) {
    container.innerHTML = `<div class="ll-empty">No words provided</div>`;
    return;
  }

  const saved = loadWidgetState<ListeningState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let typed: Record<number, string> = saved?.typed ?? {};
  let showHint = false;

  function save() {
    saveWidgetState<ListeningState>({ currentIndex, typed });
  }

  function draw() {
    if (currentIndex >= words.length) {
      drawComplete();
      return;
    }

    const item = words[currentIndex];
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${words.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / words.length) * 100}%"></div></div>
      <div class="listening-body">
        <button class="listening-play" data-action="play">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
          <span>Play</span>
        </button>
        <div class="listening-input-row">
          <input type="text" class="listening-input" placeholder="Type what you hear..." value="${escAttr(typed[currentIndex] || "")}" data-input="answer" autocomplete="off" autocorrect="off" spellcheck="false">
          <button class="ll-btn ll-btn-primary" data-action="submit">Submit</button>
        </div>
        ${item.hint ? `
          <button class="ll-btn-link" data-action="hint">${showHint ? esc(item.hint) : "Show hint"}</button>
        ` : ""}
      </div>
    `;

    const input = container.querySelector("[data-input='answer']") as HTMLInputElement;
    input?.focus();
  }

  function drawComplete() {
    const lines = words.map((w, i) =>
      `${i + 1}. Played: '${w.word}' -> User typed: '${typed[i] || ""}'`
    );
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Listening test complete!</div>
        <div class="ll-complete-sub">Sending results to Claude...</div>
      </div>
    `;

    app.updateModelContext({
      content: [{
        type: "text",
        text: `Listening test responses for '${title}':\n${lines.join("\n")}`,
      }],
    });

    app.sendMessage({
      role: "user",
      content: [{
        type: "text",
        text: "I finished the listening test. How did I do?",
      }],
    });
  }

  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.closest("[data-action]")?.getAttribute("data-action");

    if (action === "play") {
      speak(words[currentIndex].word);
      return;
    }

    if (action === "hint") {
      showHint = true;
      draw();
      return;
    }

    if (action === "submit") {
      const input = container.querySelector("[data-input='answer']") as HTMLInputElement;
      const value = input?.value.trim();
      if (!value) return;
      typed[currentIndex] = value;
      currentIndex++;
      showHint = false;
      save();
      draw();
    }
  });

  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const input = container.querySelector("[data-input='answer']") as HTMLInputElement;
      const value = input?.value.trim();
      if (!value) return;
      typed[currentIndex] = value;
      currentIndex++;
      showHint = false;
      save();
      draw();
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
