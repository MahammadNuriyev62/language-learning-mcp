import type { App } from "@modelcontextprotocol/ext-apps";

// ── Section types ────────────────────────────────────────────

export interface ReadingSection {
  type: "reading";
  title: string;
  instructions?: string;
  passage: string;
  questions: Array<{ prompt: string; options: string[] }>;
}

export interface ListeningSection {
  type: "listening";
  title: string;
  instructions?: string;
  words: Array<{ word: string; hint?: string }>;
}

export interface FillBlankSection {
  type: "fill_blank";
  title: string;
  instructions?: string;
  sentences: Array<{ text: string; hint?: string }>;
}

export interface QuizSection {
  type: "quiz";
  title: string;
  instructions?: string;
  questions: Array<{ prompt: string; options: string[] }>;
}

export interface MatchingSection {
  type: "matching";
  title: string;
  instructions?: string;
  pairs: Array<{ left: string; right: string }>;
}

export interface SentenceSection {
  type: "sentence";
  title: string;
  instructions?: string;
  exercises: Array<{ shuffledWords: string[]; translation: string; hint?: string }>;
}

export type Section = ReadingSection | ListeningSection | FillBlankSection | QuizSection | MatchingSection | SentenceSection;

export interface TestArgs {
  title: string;
  language: string;
  sections: Section[];
}

// ── State ────────────────────────────────────────────────────

export interface SectionState {
  answers: Record<string, any>;
}

export interface TestState {
  sections: Record<number, SectionState>;
  submitted?: boolean;
  resultsSent?: boolean;
}
