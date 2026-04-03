import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import { setLanguage, cancelSpeech } from "./speech";
import { setViewUUID, loadWidgetState } from "./storage";
import { renderPronounce, type PronounceArgs } from "./modes/pronounce";
import { renderFlashcards, type FlashcardArgs } from "./modes/flashcards";
import { renderQuiz, type QuizArgs } from "./modes/quiz";
import { renderListening, type ListeningArgs } from "./modes/listening";
import { renderSentence, type SentenceArgs } from "./modes/sentence";
import { renderFillBlank, type FillBlankArgs } from "./modes/fill-blank";
import { renderMatching, type MatchingArgs } from "./modes/matching";
import { renderScramble, type ScrambleArgs } from "./modes/scramble";
import { renderConversation, type ConversationArgs } from "./modes/conversation";
import { renderTest, type TestArgs } from "./modes/test/index";
import "./mcp-app.css";

const appEl = document.getElementById("app")!;

function escapeHtml(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

type Mode = "pronounce" | "flashcards" | "quiz" | "listening" | "sentence" | "fill_blank" | "matching" | "scramble" | "conversation" | "test" | null;
let currentMode: Mode = null;
let currentArgs: any = null;

function detectMode(args: any): Mode {
  if (args?.sections) return "test";
  if (args?.cards) return "flashcards";
  if (args?.questions) return "quiz";
  if (args?.pairs) return "matching";
  if (args?.turns) return "conversation";
  if (args?.sentences) return "fill_blank";
  if (args?.words && args?.title && args?.words[0]?.scrambled !== undefined) return "scramble";
  if (args?.words && args?.title) return "listening";
  if (args?.exercises) return "sentence";
  if (args?.text) return "pronounce";
  return null;
}

function render() {
  const mode = currentMode;
  const args = currentArgs;

  if (!mode || !args) {
    appEl.innerHTML = "";
    resizeToContent();
    return;
  }

  // Clear and create fresh container to avoid stale event listeners
  appEl.innerHTML = "";
  const container = document.createElement("div");
  container.className = `ll-mode ll-mode-${mode}`;
  appEl.appendChild(container);

  if (args.language) setLanguage(args.language);

  // During streaming, show a lightweight preview for test mode
  // to avoid destroying interactive DOM on every partial update
  if (isStreaming && mode === "test") {
    const testArgs = args as TestArgs;
    const sectionCount = testArgs.sections?.length ?? 0;
    const sectionNames = (testArgs.sections || []).map((s: any) => s.title || s.type || "...").filter(Boolean);
    container.innerHTML = `
      <div class="test-header">
        <div class="test-title">${testArgs.title ? escapeHtml(testArgs.title) : "Loading..."}</div>
        <div class="test-subtitle">Building test... ${sectionCount} section${sectionCount !== 1 ? "s" : ""}</div>
      </div>
      <div class="test-preview-sections">
        ${sectionNames.map((name: string, i: number) => `
          <div class="test-preview-item">
            <span class="test-section-num">Section ${i + 1}</span>
            <span>${escapeHtml(name)}</span>
          </div>
        `).join("")}
      </div>
    `;
    resizeToContent();
    return;
  }

  switch (mode) {
    case "pronounce":
      renderPronounce(container, args as PronounceArgs, app);
      break;
    case "flashcards":
      renderFlashcards(container, args as FlashcardArgs, app);
      break;
    case "quiz":
      renderQuiz(container, args as QuizArgs, app);
      break;
    case "listening":
      renderListening(container, args as ListeningArgs, app);
      break;
    case "sentence":
      renderSentence(container, args as SentenceArgs, app);
      break;
    case "fill_blank":
      renderFillBlank(container, args as FillBlankArgs, app);
      break;
    case "matching":
      renderMatching(container, args as MatchingArgs, app);
      break;
    case "scramble":
      renderScramble(container, args as ScrambleArgs, app);
      break;
    case "conversation":
      renderConversation(container, args as ConversationArgs, app);
      break;
    case "test":
      renderTest(container, args as TestArgs, app);
      break;
  }

  resizeToContent();
}

function resizeToContent() {
  requestAnimationFrame(() => {
    const w = Math.max(appEl.scrollWidth, 100);
    const h = Math.max(appEl.scrollHeight, 24);
    app.sendSizeChanged({ width: w + 16, height: h + 16 });
  });
}

// ── Host context ──────────────────────────────────────────────

function handleHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

// ── MCP App lifecycle ─────────────────────────────────────────

const app = new App(
  { name: "Language Learning", version: "1.0.0" },
  {},
  { autoResize: false },
);

app.onteardown = async () => {
  cancelSpeech();
  return {};
};

let renderTimer: ReturnType<typeof setTimeout> | null = null;
let isStreaming = false;

app.ontoolinputpartial = (params: any) => {
  const args = params.arguments;
  if (!args) return;
  isStreaming = true;
  currentMode = detectMode(args);
  currentArgs = args;
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, 150);
};

app.ontoolinput = (params: any) => {
  isStreaming = false;
  currentArgs = params.arguments ?? {};
  currentMode = detectMode(currentArgs);
  render();
};

app.ontoolresult = (result: any) => {
  const uuid = result._meta?.viewUUID ? String(result._meta.viewUUID) : undefined;
  setViewUUID(uuid);
  const saved = loadWidgetState();
  if (saved) render();
};

app.ontoolcancelled = () => {
  cancelSpeech();
};

app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
  app.sendSizeChanged({ width: 600, height: 40 });
});

// Observe size changes after renders
const observer = new MutationObserver(() => resizeToContent());
observer.observe(appEl, { childList: true, subtree: true, attributes: true });

export { app };
