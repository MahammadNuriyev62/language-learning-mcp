export function esc(str: string): string {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

export function escAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function sectionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    reading: "Reading Comprehension",
    listening: "Listening",
    fill_blank: "Fill in the Blank",
    quiz: "Multiple Choice",
    matching: "Matching",
    sentence: "Sentence Building",
  };
  return labels[type] || type;
}
