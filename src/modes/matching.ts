import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface MatchingArgs {
  title: string;
  language: string;
  pairs: Array<{
    left: string;
    right: string;
  }>;
}

interface MatchingState {
  matched: Record<number, number>;
  resultsSent?: boolean;
}

export function renderMatching(container: HTMLElement, args: MatchingArgs, app: App): void {
  const { title, pairs } = args;
  if (!pairs?.length) {
    container.innerHTML = `<div class="ll-empty">No pairs provided</div>`;
    return;
  }

  const saved = loadWidgetState<MatchingState>();
  let matched: Record<number, number> = saved?.matched ?? {};
  let resultsSent = saved?.resultsSent ?? false;

  // Shuffle right column once (deterministic from pairs)
  const rightOrder = pairs.map((_, i) => i);
  // Simple seeded shuffle based on pair count + first pair content
  let seed = pairs.length * 7 + (pairs[0]?.left.length ?? 0) * 13;
  for (let i = rightOrder.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [rightOrder[i], rightOrder[j]] = [rightOrder[j], rightOrder[i]];
  }

  let selectedLeft: number | null = null;
  let selectedRight: number | null = null;

  function save() {
    saveWidgetState<MatchingState>({ matched, resultsSent });
  }

  function isLeftMatched(i: number): boolean {
    return i in matched;
  }

  function isRightMatched(ri: number): boolean {
    return Object.values(matched).includes(ri);
  }

  function allMatched(): boolean {
    return Object.keys(matched).length >= pairs.length;
  }

  function draw() {
    if (allMatched()) {
      drawComplete();
      return;
    }

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${Object.keys(matched).length} / ${pairs.length} matched</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${(Object.keys(matched).length / pairs.length) * 100}%"></div></div>
      <div class="matching-grid">
        <div class="matching-col">
          ${pairs.map((p, i) => `
            <button class="matching-tile${isLeftMatched(i) ? " matched" : ""}${selectedLeft === i ? " selected" : ""}"
              data-left="${i}" ${isLeftMatched(i) ? "disabled" : ""}>
              ${esc(p.left)}
            </button>
          `).join("")}
        </div>
        <div class="matching-col">
          ${rightOrder.map((pi) => `
            <button class="matching-tile${isRightMatched(pi) ? " matched" : ""}${selectedRight === pi ? " selected" : ""}"
              data-right="${pi}" ${isRightMatched(pi) ? "disabled" : ""}>
              ${esc(pairs[pi].right)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function drawComplete() {
    const lines = pairs.map((p, i) => {
      const matchedRight = matched[i];
      const userRight = matchedRight !== undefined ? pairs[matchedRight].right : "?";
      return `- '${p.left}' -> User matched: '${userRight}' (correct: '${p.right}')`;
    });

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">All pairs matched!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Matching pairs responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const leftBtn = target.closest("[data-left]") as HTMLElement | null;
    if (leftBtn && !leftBtn.hasAttribute("disabled")) {
      const i = parseInt(leftBtn.dataset.left!, 10);
      selectedLeft = selectedLeft === i ? null : i;

      if (selectedLeft !== null && selectedRight !== null) {
        matched[selectedLeft] = selectedRight;
        selectedLeft = null;
        selectedRight = null;
        save();
      }
      draw();
      return;
    }

    const rightBtn = target.closest("[data-right]") as HTMLElement | null;
    if (rightBtn && !rightBtn.hasAttribute("disabled")) {
      const i = parseInt(rightBtn.dataset.right!, 10);
      selectedRight = selectedRight === i ? null : i;

      if (selectedLeft !== null && selectedRight !== null) {
        matched[selectedLeft] = selectedRight;
        selectedLeft = null;
        selectedRight = null;
        save();
      }
      draw();
      return;
    }
  });
}

function esc(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}
