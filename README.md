# language-learning-mcp

Interactive language learning MCP App for [Claude.ai](https://claude.ai). Renders flashcards, quizzes, listening tests, and sentence builders directly in chat.

The widget collects responses; Claude evaluates them.

## Tools

| Tool | What it does |
|------|-------------|
| `pronounce` | Markdown with inline TTS buttons |
| `flashcards` | Flip cards with self-rating |
| `quiz` | Multiple choice questions |
| `listening_test` | TTS playback + typed dictation |
| `sentence_builder` | Tap-to-place word tiles |

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
