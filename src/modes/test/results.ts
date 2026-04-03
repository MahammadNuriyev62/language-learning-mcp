import type { Section, TestState } from "./types";

export function buildResults(sections: Section[], state: TestState): string {
  const lines: string[] = [`Proficiency test results:\n`];

  sections.forEach((section, si) => {
    const ss = state.sections[si];
    lines.push(`--- Section ${si + 1}: ${section.title} (${section.type}) ---`);

    switch (section.type) {
      case "reading":
        section.questions.forEach((q, qi) => {
          lines.push(`  ${qi + 1}. "${q.prompt}" -> "${ss.answers[qi] || "unanswered"}"`);
        });
        break;

      case "quiz":
        section.questions.forEach((q, qi) => {
          lines.push(`  ${qi + 1}. "${q.prompt}" -> "${ss.answers[qi] || "unanswered"}"`);
        });
        break;

      case "listening":
        section.words.forEach((w, wi) => {
          lines.push(`  ${wi + 1}. Played: "${w.word}" -> Typed: "${ss.answers[wi] || ""}"`);
        });
        break;

      case "fill_blank":
        section.sentences.forEach((sent, sentIdx) => {
          const blanks = ss.answers[sentIdx] || {};
          let filled = sent.text;
          let blankNum = 0;
          filled = filled.replace(/___/g, () => `[${blanks[blankNum++] || "blank"}]`);
          lines.push(`  ${sentIdx + 1}. "${filled}"`);
        });
        break;

      case "matching":
        section.pairs.forEach((p, i) => {
          const matchedRight = ss.answers[i];
          const userRight = typeof matchedRight === "number" ? section.pairs[matchedRight].right : "unmatched";
          lines.push(`  "${p.left}" -> "${userRight}" (correct: "${p.right}")`);
        });
        break;

      case "sentence":
        section.exercises.forEach((ex, ei) => {
          const data = ss.answers[ei] || { built: [] };
          lines.push(`  ${ei + 1}. "${ex.translation}" -> "${(data.built || []).join(" ")}"`);
        });
        break;
    }

    lines.push("");
  });

  return lines.join("\n");
}
