import type { App } from "@modelcontextprotocol/ext-apps";
import { speak, speakButtonHtml } from "../speech";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface FlashcardArgs {
  deckTitle: string;
  language: string;
  cards: Array<{
    front: string;
    back: string;
    hint?: string;
    example?: string;
  }>;
}

interface FlashcardState {
  currentIndex: number;
  ratings: Record<number, string>;
  resultsSent?: boolean;
}

export function renderFlashcards(container: HTMLElement, args: FlashcardArgs, app: App): void {
  const { deckTitle, cards } = args;
  if (!cards?.length) {
    container.innerHTML = `<div class="ll-empty">No cards provided</div>`;
    return;
  }

  const saved = loadWidgetState<FlashcardState>();
  let currentIndex = saved?.currentIndex ?? 0;
  let ratings: Record<number, string> = saved?.ratings ?? {};
  let resultsSent = saved?.resultsSent ?? false;
  let flipped = false;

  function save() {
    saveWidgetState<FlashcardState>({ currentIndex, ratings, resultsSent });
  }

  function draw() {
    if (currentIndex >= cards.length) {
      drawComplete();
      return;
    }

    const card = cards[currentIndex];
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(deckTitle)}</span>
        <span class="ll-progress">${currentIndex + 1} / ${cards.length}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${((currentIndex) / cards.length) * 100}%"></div></div>
      <div class="flashcard${flipped ? " flipped" : ""}" data-action="flip">
        <div class="flashcard-inner">
          <div class="flashcard-front">
            <div class="flashcard-word">${esc(card.front)} ${speakButtonHtml(card.front, "speak-lg")}</div>
            ${card.hint ? `<div class="flashcard-hint">${esc(card.hint)}</div>` : ""}
          </div>
          <div class="flashcard-back">
            <div class="flashcard-translation">${esc(card.back)}</div>
            ${card.example ? `<div class="flashcard-example">${esc(card.example)}</div>` : ""}
          </div>
        </div>
      </div>
      ${flipped ? `
        <div class="ll-rating-row">
          <button class="ll-btn ll-btn-again" data-rate="Again">Again</button>
          <button class="ll-btn ll-btn-hard" data-rate="Hard">Hard</button>
          <button class="ll-btn ll-btn-good" data-rate="Good">Good</button>
          <button class="ll-btn ll-btn-easy" data-rate="Easy">Easy</button>
        </div>
      ` : `<div class="ll-hint-text">Tap card to flip</div>`}
    `;
  }

  function drawComplete() {
    const lines = cards.map((c, i) => `- '${c.front}' (${c.back}): ${ratings[i] || "skipped"}`);
    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(deckTitle)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">All ${cards.length} cards reviewed!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Flashcard results for '${deckTitle}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Speak button
    const speakBtn = target.closest("[data-speak]") as HTMLElement | null;
    if (speakBtn?.dataset.speak) {
      e.stopPropagation();
      speak(speakBtn.dataset.speak, draw);
      return;
    }

    // Flip card
    if (target.closest("[data-action='flip']") && !flipped) {
      flipped = true;
      draw();
      return;
    }

    // Rating buttons
    const rateBtn = target.closest("[data-rate]") as HTMLElement | null;
    if (rateBtn?.dataset.rate) {
      ratings[currentIndex] = rateBtn.dataset.rate;
      currentIndex++;
      flipped = false;
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
