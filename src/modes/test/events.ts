import { speak } from "../../speech";
import type { TestState } from "./types";

export function setupEventHandlers(
  container: HTMLElement,
  state: TestState,
  save: () => void,
  draw: () => void,
): void {
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // TTS
    const speakBtn = target.closest("[data-speak]") as HTMLElement | null;
    if (speakBtn?.dataset.speak) {
      e.stopPropagation();
      speak(speakBtn.dataset.speak);
      return;
    }

    // Quiz/reading option
    const optBtn = target.closest("[data-quiz-option]") as HTMLElement | null;
    if (optBtn) {
      const si = parseInt(optBtn.dataset.section!, 10);
      const qi = optBtn.dataset.question!;
      state.sections[si].answers[qi] = optBtn.dataset.quizOption!;
      save();
      draw();
      return;
    }

    // Matching: left tile
    const matchLeft = target.closest("[data-match-left]") as HTMLElement | null;
    if (matchLeft) {
      handleMatchTap(state, parseInt(matchLeft.dataset.section!, 10), "left", matchLeft.dataset.matchLeft!, save, draw);
      return;
    }

    // Matching: right tile
    const matchRight = target.closest("[data-match-right]") as HTMLElement | null;
    if (matchRight) {
      handleMatchTap(state, parseInt(matchRight.dataset.section!, 10), "right", matchRight.dataset.matchRight!, save, draw);
      return;
    }

    // Sentence: pool -> built
    const poolTile = target.closest("[data-sent-pool]") as HTMLElement | null;
    if (poolTile) {
      const si = parseInt(poolTile.dataset.section!, 10);
      const ei = poolTile.dataset.exercise!;
      const word = poolTile.dataset.sentPool!;
      const idx = parseInt(poolTile.dataset.poolIdx!, 10);
      const sec = state.sections[si];
      if (!sec.answers[ei]) sec.answers[ei] = { built: [], poolRemoved: [] };
      sec.answers[ei].built.push(word);
      sec.answers[ei].poolRemoved.push(idx);
      save();
      draw();
      return;
    }

    // Sentence: built -> pool
    const builtTile = target.closest("[data-sent-built]") as HTMLElement | null;
    if (builtTile) {
      const si = parseInt(builtTile.dataset.section!, 10);
      const ei = builtTile.dataset.exercise!;
      const bIdx = parseInt(builtTile.dataset.sentBuilt!, 10);
      const sec = state.sections[si];
      if (sec.answers[ei]) {
        sec.answers[ei].built.splice(bIdx, 1);
        sec.answers[ei].poolRemoved.splice(bIdx, 1);
      }
      save();
      draw();
      return;
    }

    // Listening play
    const playBtn = target.closest("[data-listen-play]") as HTMLElement | null;
    if (playBtn) {
      speak(playBtn.dataset.listenPlay!);
      return;
    }

    // Submit test
    if (target.closest("[data-action='submit-test']")) {
      collectTextInputs(container, state);
      state.submitted = true;
      save();
      draw();
    }
  });

  // Save text inputs on change
  container.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;

    if (target.dataset.fillInput !== undefined) {
      const si = parseInt(target.dataset.section!, 10);
      const sentIdx = target.dataset.sentIdx!;
      if (!state.sections[si].answers[sentIdx]) state.sections[si].answers[sentIdx] = {};
      state.sections[si].answers[sentIdx][target.dataset.fillInput] = target.value;
      save();
    }

    if (target.dataset.listenInput !== undefined) {
      const si = parseInt(target.dataset.section!, 10);
      state.sections[si].answers[target.dataset.listenInput] = target.value;
      save();
    }
  });
}

function handleMatchTap(
  state: TestState, si: number, side: "left" | "right", idx: string,
  save: () => void, draw: () => void,
): void {
  const sec = state.sections[si];
  const key = side === "left" ? "_selectedLeft" : "_selectedRight";
  const otherKey = side === "left" ? "_selectedRight" : "_selectedLeft";

  if (sec.answers[key] === idx) {
    delete sec.answers[key];
  } else {
    sec.answers[key] = idx;
    if (sec.answers[otherKey] !== undefined) {
      const leftIdx = side === "left" ? idx : sec.answers._selectedLeft;
      const rightIdx = side === "right" ? idx : sec.answers._selectedRight;
      sec.answers[leftIdx] = parseInt(rightIdx, 10);
      delete sec.answers._selectedLeft;
      delete sec.answers._selectedRight;
    }
  }
  save();
  draw();
}

function collectTextInputs(container: HTMLElement, state: TestState): void {
  container.querySelectorAll<HTMLInputElement>("[data-fill-input]").forEach((inp) => {
    const si = parseInt(inp.dataset.section!, 10);
    const sentIdx = inp.dataset.sentIdx!;
    if (!state.sections[si].answers[sentIdx]) state.sections[si].answers[sentIdx] = {};
    state.sections[si].answers[sentIdx][inp.dataset.fillInput!] = inp.value.trim();
  });
  container.querySelectorAll<HTMLInputElement>("[data-listen-input]").forEach((inp) => {
    const si = parseInt(inp.dataset.section!, 10);
    state.sections[si].answers[inp.dataset.listenInput!] = inp.value.trim();
  });
}
