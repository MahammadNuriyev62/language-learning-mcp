import type { App } from "@modelcontextprotocol/ext-apps";
import { saveWidgetState, loadWidgetState } from "../../storage";
import { esc, sectionTypeLabel } from "./helpers";
import { renderSection } from "./sections";
import { buildResults } from "./results";
import { setupEventHandlers } from "./events";
import type { TestArgs, TestState } from "./types";

export type { TestArgs } from "./types";

export function renderTest(container: HTMLElement, args: TestArgs, app: App): void {
  const { title, sections } = args;
  if (!sections?.length) {
    container.innerHTML = `<div class="ll-empty">No sections provided</div>`;
    return;
  }

  const saved = loadWidgetState<TestState>();
  const state: TestState = {
    sections: saved?.sections ?? {},
    submitted: saved?.submitted ?? false,
    resultsSent: saved?.resultsSent ?? false,
  };

  for (let i = 0; i < sections.length; i++) {
    if (!state.sections[i]) state.sections[i] = { answers: {} };
  }

  function save() {
    saveWidgetState(state);
  }

  function draw() {
    if (state.submitted) {
      drawSubmitted();
      return;
    }

    let html = `
      <div class="test-header">
        <div class="test-title">${esc(title)}</div>
        <div class="test-subtitle">${sections.length} sections</div>
      </div>
    `;

    sections.forEach((section, si) => {
      html += `<div class="test-section" id="section-${si}">`;
      html += `<div class="test-section-header">
        <span class="test-section-num">Section ${si + 1}</span>
        <span class="test-section-title">${esc(section.title)}</span>
        <span class="test-section-type">${sectionTypeLabel(section.type)}</span>
      </div>`;

      if (section.instructions) {
        html += `<div class="test-instructions">${esc(section.instructions)}</div>`;
      }

      html += renderSection(section, si, state.sections[si]);
      html += `</div>`;
    });

    html += `<button class="ll-btn ll-btn-primary test-submit-btn" data-action="submit-test">Submit Test</button>`;
    container.innerHTML = html;
  }

  function drawSubmitted() {
    container.innerHTML = `
      <div class="test-header">
        <div class="test-title">${esc(title)}</div>
        <div class="test-subtitle">Test submitted</div>
      </div>
      <div class="ll-complete">
        <div class="ll-complete-icon">&#10003;</div>
        <div class="ll-complete-text">Test complete!</div>
        <div class="ll-complete-sub">${state.resultsSent ? "Results sent to Claude" : "Sending results to Claude..."}</div>
      </div>
    `;

    if (!state.resultsSent) {
      state.resultsSent = true;
      save();
      app.updateModelContext({
        content: [{ type: "text", text: buildResults(sections, state) }],
      });
    }
  }

  draw();
  setupEventHandlers(container, state, save, draw);
}
