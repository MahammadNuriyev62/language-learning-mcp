import type { App } from "@modelcontextprotocol/ext-apps";
import { speak, speakButtonHtml } from "../speech";
import { saveWidgetState, loadWidgetState } from "../storage";

export interface ConversationArgs {
  title: string;
  language: string;
  turns: Array<{
    speaker: string;
    text: string;
    options?: string[];
  }>;
}

interface ConversationState {
  responses: Record<number, string>;
  revealedUpTo: number;
  resultsSent?: boolean;
}

export function renderConversation(container: HTMLElement, args: ConversationArgs, app: App): void {
  const { title, turns } = args;
  if (!turns?.length) {
    container.innerHTML = `<div class="ll-empty">No conversation provided</div>`;
    return;
  }

  const saved = loadWidgetState<ConversationState>();
  let responses: Record<number, string> = saved?.responses ?? {};
  let revealedUpTo = saved?.revealedUpTo ?? 0;
  let resultsSent = saved?.resultsSent ?? false;

  // Advance revealedUpTo past non-option turns
  function advanceReveal() {
    while (revealedUpTo < turns.length && !turns[revealedUpTo].options) {
      revealedUpTo++;
    }
  }

  function save() {
    saveWidgetState<ConversationState>({ responses, revealedUpTo, resultsSent });
  }

  function isComplete(): boolean {
    // Complete when we've revealed past all turns
    return revealedUpTo >= turns.length;
  }

  function draw() {
    advanceReveal();

    if (isComplete()) {
      drawComplete();
      return;
    }

    const totalOptions = turns.filter((t) => t.options).length;
    const answeredOptions = Object.keys(responses).length;

    let html = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">${answeredOptions} / ${totalOptions}</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:${totalOptions ? (answeredOptions / totalOptions) * 100 : 0}%"></div></div>
      <div class="convo-dialogue">`;

    // Show all turns up to and including revealedUpTo
    for (let i = 0; i <= revealedUpTo && i < turns.length; i++) {
      const turn = turns[i];
      const isUserTurn = !!turn.options;

      if (isUserTurn && i < revealedUpTo) {
        // Already answered
        html += `
          <div class="convo-bubble convo-user">
            <div class="convo-speaker">You</div>
            <div class="convo-text">${esc(responses[i] || "")}</div>
          </div>`;
      } else if (isUserTurn && i === revealedUpTo) {
        // Current choice
        html += `
          <div class="convo-choices">
            ${turn.options!.map((opt) => `
              <button class="convo-choice" data-choice="${escAttr(opt)}" data-turn="${i}">
                ${esc(opt)}
              </button>
            `).join("")}
          </div>`;
      } else {
        // NPC turn
        html += `
          <div class="convo-bubble convo-npc">
            <div class="convo-speaker">${esc(turn.speaker)} ${speakButtonHtml(turn.text)}</div>
            <div class="convo-text">${esc(turn.text)}</div>
          </div>`;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    // Scroll to bottom of dialogue
    const dialogue = container.querySelector(".convo-dialogue");
    if (dialogue) dialogue.scrollTop = dialogue.scrollHeight;
  }

  function drawComplete() {
    const lines: string[] = [];
    turns.forEach((turn, i) => {
      if (turn.options) {
        lines.push(`- [You] chose: '${responses[i] || "skipped"}' (options: ${turn.options.join(", ")})`);
      } else {
        lines.push(`- [${turn.speaker}]: '${turn.text}'`);
      }
    });

    container.innerHTML = `
      <div class="ll-header">
        <span class="ll-title">${esc(title)}</span>
        <span class="ll-progress">Complete</span>
      </div>
      <div class="ll-progress-bar"><div class="ll-progress-fill" style="width:100%"></div></div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Conversation complete!</div>
        <div class="ll-complete-sub">${resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!resultsSent) {
      resultsSent = true;
      save();

      app.updateModelContext({
        content: [{
          type: "text",
          text: `Conversation responses for '${title}':\n${lines.join("\n")}`,
        }],
      });
    }
  }

  draw();

  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const speakBtn = target.closest("[data-speak]") as HTMLElement | null;
    if (speakBtn?.dataset.speak) {
      e.stopPropagation();
      speak(speakBtn.dataset.speak, draw);
      return;
    }

    const choiceBtn = target.closest("[data-choice]") as HTMLElement | null;
    if (choiceBtn?.dataset.choice && choiceBtn.dataset.turn) {
      const turnIdx = parseInt(choiceBtn.dataset.turn, 10);
      responses[turnIdx] = choiceBtn.dataset.choice;
      revealedUpTo = turnIdx + 1;
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
