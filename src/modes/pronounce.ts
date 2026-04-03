import type { App } from "@modelcontextprotocol/ext-apps";
import { marked } from "marked";
import { speak, speakButtonHtml, getSpeakingWord } from "../speech";

marked.setOptions({ breaks: true, gfm: true });

export interface PronounceArgs {
  text: string;
  language: string;
}

export function renderPronounce(container: HTMLElement, args: PronounceArgs, app: App): void {
  const { text } = args;

  function draw() {
    if (!text) {
      container.innerHTML = "";
      return;
    }
    let html = marked.parse(text) as string;
    html = html.replace(/\{\{(.+?)\}\}/g, (_match, word) => {
      const isSpeaking = getSpeakingWord() === word;
      return (
        `<span class="pronounce-word">` +
          `<span class="word-text">${word}</span>` +
          speakButtonHtml(word) +
        `</span>`
      );
    });
    container.innerHTML = html;
  }

  draw();

  container.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-speak]") as HTMLElement | null;
    if (btn?.dataset.speak) speak(btn.dataset.speak, draw);
  });
}
