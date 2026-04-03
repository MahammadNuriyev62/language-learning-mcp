import { esc, escAttr } from "./helpers";
import type {
  Section, SectionState,
  ReadingSection, ListeningSection, FillBlankSection,
  QuizSection, MatchingSection, SentenceSection,
} from "./types";

export function renderSection(section: Section, si: number, ss: SectionState): string {
  switch (section.type) {
    case "reading": return renderReading(section, si, ss);
    case "listening": return renderListening(section, si, ss);
    case "fill_blank": return renderFillBlank(section, si, ss);
    case "quiz": return renderQuiz(section, si, ss);
    case "matching": return renderMatching(section, si, ss);
    case "sentence": return renderSentence(section, si, ss);
    default: return `<div class="ll-empty">Unknown section type</div>`;
  }
}

function quizOptionsHtml(options: string[], chosen: string | undefined, si: number, qi: number): string {
  return `<div class="quiz-options">
    ${options.map((opt) => `
      <button class="quiz-option${chosen === opt ? " selected" : ""}"
        data-quiz-option="${escAttr(opt)}" data-section="${si}" data-question="${qi}">
        ${esc(opt)}
      </button>
    `).join("")}
  </div>`;
}

function renderReading(s: ReadingSection, si: number, ss: SectionState): string {
  let html = `<div class="test-passage">${esc(s.passage)}</div>`;
  s.questions.forEach((q, qi) => {
    html += `<div class="test-question">
      <div class="test-q-num">${qi + 1}.</div>
      <div class="test-q-body">
        <div class="test-q-prompt">${esc(q.prompt)}</div>
        ${quizOptionsHtml(q.options, ss.answers[qi], si, qi)}
      </div>
    </div>`;
  });
  return html;
}

function renderListening(s: ListeningSection, si: number, ss: SectionState): string {
  let html = "";
  s.words.forEach((w, wi) => {
    const val = ss.answers[wi] || "";
    html += `<div class="test-listen-item">
      <span class="test-listen-num">${wi + 1}.</span>
      <button class="test-listen-play" data-listen-play="${escAttr(w.word)}" data-section="${si}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
      <input type="text" class="listening-input test-listen-input" value="${escAttr(val)}"
        placeholder="Type what you hear..."
        data-listen-input="${wi}" data-section="${si}"
        autocomplete="off" autocorrect="off" spellcheck="false">
    </div>`;
  });
  return html;
}

function renderFillBlank(s: FillBlankSection, si: number, ss: SectionState): string {
  let html = "";
  s.sentences.forEach((sent, sentIdx) => {
    const parts = sent.text.split("___");
    const blanks = parts.length - 1;
    html += `<div class="test-fill-item"><span class="test-fill-num">${sentIdx + 1}.</span><span class="test-fill-text">`;
    for (let i = 0; i < parts.length; i++) {
      html += esc(parts[i]);
      if (i < blanks) {
        const val = ss.answers[sentIdx]?.[i] || "";
        html += `<input type="text" class="fill-input" value="${escAttr(val)}"
          placeholder="..."
          data-fill-input="${i}" data-sent-idx="${sentIdx}" data-section="${si}"
          autocomplete="off" autocorrect="off" spellcheck="false">`;
      }
    }
    html += `</span></div>`;
    if (sent.hint) {
      html += `<div class="test-fill-hint">${esc(sent.hint)}</div>`;
    }
  });
  return html;
}

function renderQuiz(s: QuizSection, si: number, ss: SectionState): string {
  let html = "";
  s.questions.forEach((q, qi) => {
    html += `<div class="test-question">
      <div class="test-q-num">${qi + 1}.</div>
      <div class="test-q-body">
        <div class="test-q-prompt">${esc(q.prompt)}</div>
        ${quizOptionsHtml(q.options, ss.answers[qi], si, qi)}
      </div>
    </div>`;
  });
  return html;
}

function renderMatching(s: MatchingSection, si: number, ss: SectionState): string {
  const selectedLeft = ss.answers._selectedLeft;
  const selectedRight = ss.answers._selectedRight;

  const rightOrder = s.pairs.map((_, i) => i);
  let seed = s.pairs.length * 7 + (s.pairs[0]?.left.length ?? 0) * 13;
  for (let i = rightOrder.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [rightOrder[i], rightOrder[j]] = [rightOrder[j], rightOrder[i]];
  }

  const isLeftMatched = (i: number) => ss.answers[i] !== undefined && typeof ss.answers[i] === "number";
  const isRightMatched = (ri: number) => Object.entries(ss.answers).some(([k, v]) => k[0] !== "_" && v === ri);

  return `<div class="matching-grid">
    <div class="matching-col">
      ${s.pairs.map((p, i) => `
        <button class="matching-tile${isLeftMatched(i) ? " matched" : ""}${selectedLeft === String(i) ? " selected" : ""}"
          data-match-left="${i}" data-section="${si}" ${isLeftMatched(i) ? "disabled" : ""}>
          ${esc(p.left)}
        </button>
      `).join("")}
    </div>
    <div class="matching-col">
      ${rightOrder.map((pi) => `
        <button class="matching-tile${isRightMatched(pi) ? " matched" : ""}${selectedRight === String(pi) ? " selected" : ""}"
          data-match-right="${pi}" data-section="${si}" ${isRightMatched(pi) ? "disabled" : ""}>
          ${esc(s.pairs[pi].right)}
        </button>
      `).join("")}
    </div>
  </div>`;
}

function renderSentence(s: SentenceSection, si: number, ss: SectionState): string {
  let html = "";
  s.exercises.forEach((ex, ei) => {
    const data = ss.answers[ei] || { built: [], poolRemoved: [] };
    const builtWords: string[] = data.built || [];
    const removedIndices: number[] = data.poolRemoved || [];

    html += `<div class="test-sentence-item">
      <div class="test-q-num">${ei + 1}.</div>
      <div class="test-q-body">
        <div class="sentence-translation">${esc(ex.translation)}</div>
        ${ex.hint ? `<div class="sentence-hint">${esc(ex.hint)}</div>` : ""}
        <div class="sentence-built">
          ${builtWords.length
            ? builtWords.map((w, bi) =>
                `<span class="sentence-tile placed" data-sent-built="${bi}" data-section="${si}" data-exercise="${ei}">${esc(w)}</span>`
              ).join("")
            : `<span class="sentence-placeholder">Tap words to build sentence</span>`
          }
        </div>
        <div class="sentence-pool">
          ${ex.shuffledWords.map((w, wi) => {
            if (removedIndices.includes(wi)) return "";
            return `<span class="sentence-tile" data-sent-pool="${escAttr(w)}" data-pool-idx="${wi}" data-section="${si}" data-exercise="${ei}">${esc(w)}</span>`;
          }).join("")}
        </div>
      </div>
    </div>`;
  });
  return html;
}
