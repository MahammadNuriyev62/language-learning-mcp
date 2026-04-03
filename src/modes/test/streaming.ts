import { esc, sectionTypeLabel } from "./helpers";
import { renderSection } from "./sections";
import type { TestArgs, SectionState } from "./types";

/**
 * Incrementally render the test during streaming.
 * Only adds new sections to the DOM, never removes existing ones.
 * Returns the container (reused or newly created).
 */
export function streamTest(appEl: HTMLElement, args: TestArgs): HTMLElement {
  const { title, sections } = args;

  // Reuse existing container or create one
  let container = appEl.querySelector<HTMLElement>(".ll-mode-test");
  if (!container) {
    appEl.innerHTML = "";
    container = document.createElement("div");
    container.className = "ll-mode ll-mode-test";
    appEl.appendChild(container);
  }

  // Ensure header exists
  let header = container.querySelector<HTMLElement>(".test-header");
  if (!header) {
    header = document.createElement("div");
    header.className = "test-header";
    container.appendChild(header);
  }
  header.innerHTML = `
    <div class="test-title">${title ? esc(title) : "..."}</div>
    <div class="test-subtitle">${sections?.length ?? 0} sections</div>
  `;

  if (!sections?.length) return container;

  // Count how many sections are already rendered
  const renderedSections = container.querySelectorAll<HTMLElement>(".test-section");
  const renderedCount = renderedSections.length;

  // Guard: if the partial parse shows fewer sections than we've already
  // rendered, the JSON is likely truncated mid-array. Don't touch the DOM.
  if (sections.length < renderedCount) return container;

  // Update the last rendered section (it may have been incomplete during previous partial)
  if (renderedCount > 0) {
    const lastIdx = renderedCount - 1;
    const lastSection = sections[lastIdx];
    if (lastSection) {
      const lastEl = renderedSections[lastIdx];
      const emptySectionState: SectionState = { answers: {} };
      const newHtml = buildSectionHtml(lastSection, lastIdx, emptySectionState);
      // Only update if content actually changed (avoids input field reset)
      if (lastEl.innerHTML !== newHtml) {
        lastEl.innerHTML = newHtml;
      }
    }
  }

  // Append brand new sections
  for (let i = renderedCount; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    const sectionEl = document.createElement("div");
    sectionEl.className = "test-section";
    sectionEl.id = `section-${i}`;
    const emptySectionState: SectionState = { answers: {} };
    sectionEl.innerHTML = buildSectionHtml(section, i, emptySectionState);
    container.appendChild(sectionEl);
  }

  return container;
}

function buildSectionHtml(section: any, si: number, ss: SectionState): string {
  let html = `<div class="test-section-header">
    <span class="test-section-num">Section ${si + 1}</span>
    <span class="test-section-title">${esc(section.title || "...")}</span>
    <span class="test-section-type">${sectionTypeLabel(section.type || "")}</span>
  </div>`;

  if (section.instructions) {
    html += `<div class="test-instructions">${esc(section.instructions)}</div>`;
  }

  // Only render section content if it has actual data (not just a title stub)
  const hasContent =
    section.questions?.length ||
    section.words?.length ||
    section.sentences?.length ||
    section.pairs?.length ||
    section.exercises?.length ||
    section.passage;

  if (hasContent) {
    html += renderSection(section, si, ss);
  }

  return html;
}
