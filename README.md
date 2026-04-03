# language-learning-mcp

Interactive language learning MCP App for [Claude.ai](https://claude.ai). Renders exercises directly in chat with TTS pronunciation. The widget collects responses; Claude evaluates them.

## Tools

| Tool | What it does |
|------|-------------|
| `pronounce` | Markdown with inline TTS buttons |
| `flashcards` | Flip cards with self-rating |
| `quiz` | Multiple choice questions |
| `listening_test` | TTS playback + typed dictation |
| `sentence_builder` | Tap-to-place word tiles |
| `fill_blank` | Sentences with blanks to fill in |
| `matching` | Two-column tap-to-match pairs |
| `word_scramble` | Rearrange scrambled letters |
| `conversation` | Chat-style dialogue with response choices |
| `proficiency_test` | Multi-section exam (DELF/TOEFL style) on one page |

## Connect

Add this MCP server URL in Claude.ai settings:

```
https://language-learning-mcp.maganuriyev.workers.dev/mcp
```

## Develop

```bash
npm install
npm run dev          # watch mode
npm run deploy       # build + deploy to CF Workers
```
