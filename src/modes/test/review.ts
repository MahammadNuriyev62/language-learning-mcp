import { esc, escAttr } from "./helpers";
import type {
  Section, SectionState,
  ReadingSection, ListeningSection, FillBlankSection,
  QuizSection, MatchingSection, SentenceSection,
} from "./types";

export function renderSectionReview(section: Section, si: number, ss: SectionState): string {
  switch (section.type) {
    case "reading": return reviewReading(section, ss);
    case "listening": return reviewListening(section, ss);
    case "fill_blank": return reviewFillBlank(section, ss);
    case "quiz": return reviewQuiz(section, ss);
    case "matching": return reviewMatching(section, ss);
    case "sentence": return reviewSentence(section, ss);
    default: return "";
  }
}

function reviewReading(s: ReadingSection, ss: SectionState): string {
  let html = `<div class="test-passage">${esc(s.passage)}</div>`;
  s.questions.forEach((q, qi) => {
    const chosen = ss.answers[qi] || "";
    html += `<div class="test-question">
      <div class="test-q-num">${qi + 1}.</div>
      <div class="test-q-body">
        <div class="test-q-prompt">${esc(q.prompt)}</div>
        <div class="quiz-options">
          ${q.options.map((opt) => `
            <div class="quiz-option${chosen === opt ? " selected" : ""}" style="pointer-events:none">
              ${esc(opt)}
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;
  });
  return html;
}

function reviewListening(s: ListeningSection, ss: SectionState): string {
  let html = "";
  s.words.forEach((w, wi) => {
    const typed = ss.answers[wi] || "";
    html += `<div class="test-listen-item">
      <span class="test-listen-num">${wi + 1}.</span>
      <span class="test-review-answer">${typed ? esc(typed) : `<em style="opacity:0.4">no answer</em>`}</span>
    </div>`;
  });
  return html;
}

function reviewFillBlank(s: FillBlankSection, ss: SectionState): string {
  let html = "";
  s.sentences.forEach((sent, sentIdx) => {
    const parts = sent.text.split("___");
    const blanks = parts.length - 1;
    html += `<div class="test-fill-item"><span class="test-fill-num">${sentIdx + 1}.</span><span class="test-fill-text">`;
    for (let i = 0; i < parts.length; i++) {
      html += esc(parts[i]);
      if (i < blanks) {
        const val = ss.answers[sentIdx]?.[i] || "";
        html += `<span class="test-review-inline">${val ? esc(val) : "___"}</span>`;
      }
    }
    html += `</span></div>`;
  });
  return html;
}

function reviewQuiz(s: QuizSection, ss: SectionState): string {
  let html = "";
  s.questions.forEach((q, qi) => {
    const chosen = ss.answers[qi] || "";
    html += `<div class="test-question">
      <div class="test-q-num">${qi + 1}.</div>
      <div class="test-q-body">
        <div class="test-q-prompt">${esc(q.prompt)}</div>
        <div class="quiz-options">
          ${q.options.map((opt) => `
            <div class="quiz-option${chosen === opt ? " selected" : ""}" style="pointer-events:none">
              ${esc(opt)}
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;
  });
  return html;
}

function reviewMatching(s: MatchingSection, ss: SectionState): string {
  let html = `<div class="test-review-matches">`;
  s.pairs.forEach((p, i) => {
    const matchedRight = ss.answers[i];
    const userRight = typeof matchedRight === "number" ? s.pairs[matchedRight].right : "?";
    html += `<div class="test-review-match-row">
      <span class="test-review-match-left">${esc(p.left)}</span>
      <span class="test-review-match-arrow">&rarr;</span>
      <span class="test-review-match-right">${esc(userRight)}</span>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function reviewSentence(s: SentenceSection, ss: SectionState): string {
  let html = "";
  s.exercises.forEach((ex, ei) => {
    const data = ss.answers[ei] || { built: [] };
    const builtWords: string[] = data.built || [];
    html += `<div class="test-question">
      <div class="test-q-num">${ei + 1}.</div>
      <div class="test-q-body">
        <div class="test-q-prompt">${esc(ex.translation)}</div>
        <div class="test-review-answer">${builtWords.length ? esc(builtWords.join(" ")) : `<em style="opacity:0.4">no answer</em>`}</div>
      </div>
    </div>`;
  });
  return html;
}
