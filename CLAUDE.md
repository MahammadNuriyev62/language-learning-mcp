# language-learning-mcp

Interactive language learning MCP App for Claude.ai. Evolution of [pronounce-mcp](https://github.com/MahammadNuriyev62/pronounce-mcp).

Renders interactive exercises (flashcards, quizzes, listening tests, sentence builders) with TTS pronunciation directly in Claude's chat interface. The widget is purely a UI layer that collects user responses. Claude sees all responses and evaluates performance itself.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **MCP SDK**: `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`
- **Build**: Vite + `vite-plugin-singlefile` (bundles HTML into single file for worker import)
- **Language**: TypeScript
- **Validation**: Zod
- **Markdown**: `marked` (for pronounce mode)

## Architecture

### Core Design Principle

**The widget does NOT check answers.** It is purely a convenient, interactive UI for presenting exercises and collecting user responses. When the user finishes an exercise, the widget sends all raw responses back to Claude via `updateModelContext()`. Claude sees everything in bulk and provides its own evaluation, corrections, and encouragement.

This means:
- No `correctIndex` in quiz schemas
- No `acceptedSpellings` in listening schemas
- No `targetSentence` validation in sentence builder
- No green/red answer highlighting in the UI
- No score calculation in the widget

### Single UI Resource, Multiple Tools

All tools share one `mcp-app.html` resource URI (`ui://language-learning/mcp-app.html`). The UI detects the current mode from the tool input and renders the appropriate exercise type.

### Persistence

**Claude IS the memory.** No client-side SRS or progress tracking. Claude uses conversation history and `conversation_search` to remember past sessions and adapt.

**localStorage** is used ONLY for within-session widget state: if the page reloads mid-exercise, the user doesn't restart from question 1. Uses the official ext-apps `viewUUID` pattern.

### Tools

Five tools, all registered with `registerAppTool` pointing to the same `resourceUri`:

#### 1. `pronounce` (existing, unchanged)

```
Input: { text: string, language: string }
```

Renders markdown with inline `{{word}}` TTS buttons.

#### 2. `flashcards`

```
Input: {
  deckTitle: string,
  language: string,
  cards: Array<{
    front: string,       // word/phrase in target language
    back: string,        // translation/meaning
    hint?: string,       // optional hint
    example?: string     // example sentence
  }>
}
```

UI: Shows card front with TTS button. Tap to flip and see back. User self-rates: Again / Hard / Good / Easy. Advances to next card. At the end, sends all ratings to Claude:

```
updateModelContext: "Flashcard results for 'Food Vocabulary':
- 'le pain' (bread): Good
- 'le fromage' (cheese): Easy
- 'la viande' (meat): Again
- 'le poisson' (fish): Hard
..."
```

#### 3. `quiz`

```
Input: {
  title: string,
  language: string,
  questions: Array<{
    prompt: string,       // the question
    options: string[]     // 2-4 choices (NO correctIndex)
  }>
}
```

UI: Shows one question at a time with tappable option buttons. When user picks an option, it highlights their choice (neutral color, no correct/wrong indication) and advances. At the end, sends all choices to Claude:

```
updateModelContext: "Quiz responses for 'French Verb Conjugation':
1. 'What is the past participle of manger?' -> User chose: 'mangé'
2. 'Complete: Je ___ au marché hier' -> User chose: 'suis allé'
3. 'Which is correct?' -> User chose: 'Il fait beau'
..."
```

Claude then evaluates which were correct, explains mistakes, and gives a score.

#### 4. `listening_test`

```
Input: {
  title: string,
  language: string,
  words: Array<{
    word: string,        // the word to pronounce via TTS (NOT shown to user)
    hint?: string        // optional hint shown on request
  }>
}
```

UI: Shows a play button. User taps to hear the word via TTS. Text input below. User types what they heard and submits. Advances to next word. At the end, sends all attempts to Claude:

```
updateModelContext: "Listening test responses for 'Common French Words':
1. Played: 'bonjour' -> User typed: 'bonjour'
2. Played: 'aujourd'hui' -> User typed: 'aujourdui'
3. Played: 'bibliothèque' -> User typed: 'bibliotek'
..."
```

Claude evaluates spelling, notes common patterns in mistakes, etc.

#### 5. `sentence_builder`

```
Input: {
  title: string,
  language: string,
  exercises: Array<{
    shuffledWords: string[],  // words in shuffled order
    translation: string,      // meaning shown to user as prompt
    hint?: string
  }>
}
```

UI: Shows the translation as a prompt. Below it, a pool of tappable word tiles. User taps tiles to build a sentence. Tap placed tiles to remove them. Submit button sends their arrangement. At the end, sends all arrangements to Claude:

```
updateModelContext: "Sentence builder responses for 'Daily Routines':
1. Translation: 'I go to school every day'
   Words given: [tous, vais, les, je, jours, à, l'école]
   User built: 'je vais à l'école tous les jours'
2. Translation: 'She eats breakfast at 8am'
   Words given: [mange, à, elle, petit-déjeuner, 8h, son]
   User built: 'elle mange son petit-déjeuner à 8h'
..."
```

## File Structure

```
language-learning-mcp/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
├── worker.ts              # CF Worker: registers all tools + resource
├── icon.svg
├── icon.png
├── mcp-app.html           # Vite entry (shell, loads mcp-app.ts)
└── src/
    ├── mcp-app.ts          # App entry: mode router, lifecycle, host context
    ├── mcp-app.css         # Shared base styles
    ├── speech.ts           # TTS logic (extracted from pronounce-mcp)
    ├── storage.ts          # Minimal: viewUUID + current position only
    └── modes/
        ├── pronounce.ts    # Existing markdown + TTS renderer
        ├── flashcards.ts   # Flip cards with self-rating
        ├── quiz.ts         # Multiple choice (no answer checking)
        ├── listening.ts    # TTS playback + text input (no spell checking)
        └── sentence.ts     # Tap-to-place word tiles (no order checking)
```

## Persistence (Minimal)

Only stores current widget position so page reloads don't lose progress mid-exercise.

**Server side** (worker.ts): Return `_meta.viewUUID` in every tool result:

```typescript
return {
  content: [{ type: "text", text: `Flashcard deck "${deckTitle}" with ${cards.length} cards` }],
  _meta: { viewUUID: crypto.randomUUID() },
};
```

**Client side** (storage.ts):

```typescript
let viewUUID: string | undefined;

export function setViewUUID(uuid: string | undefined) {
  viewUUID = uuid;
}

export function saveWidgetState<T>(state: T): void {
  if (!viewUUID) return;
  try {
    localStorage.setItem(`ll:${viewUUID}`, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save widget state:", err);
  }
}

export function loadWidgetState<T>(): T | null {
  if (!viewUUID) return null;
  try {
    const saved = localStorage.getItem(`ll:${viewUUID}`);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}
```

Each mode stores only position + raw responses so far:
- **flashcards**: `{ currentIndex: number, ratings: Record<number, string> }`
- **quiz**: `{ currentIndex: number, choices: Record<number, string> }`
- **listening**: `{ currentIndex: number, typed: Record<number, string> }`
- **sentence**: `{ currentIndex: number, built: Record<number, string[]> }`

## Sending Results to Claude

When the user completes all items in an exercise, the widget calls `updateModelContext()` with a structured summary of every response. Claude sees this and provides evaluation in its next message.

```typescript
// Example: after quiz completion
await app.updateModelContext({
  content: [{
    type: "text",
    text: [
      `Quiz completed: "${title}"`,
      ``,
      ...questions.map((q, i) => {
        const chosen = userChoices[i];
        return `${i + 1}. "${q.prompt}" -> User chose: "${chosen}"`;
      }),
    ].join("\n"),
  }],
});

// Then trigger Claude to respond
await app.sendMessage({
  role: "user",
  content: [{
    type: "text",
    text: "I finished the quiz. How did I do?",
  }],
});
```

The widget also has an "Ask Claude" button available during exercises:

```typescript
app.sendMessage({
  role: "user",
  content: [{
    type: "text",
    text: `I need help. Currently on: "${currentItem}". Can you give me a hint?`,
  }],
});
```

## UI Router (mcp-app.ts)

Detects which tool was called based on the shape of the input arguments:

```typescript
import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { setViewUUID, loadWidgetState } from "./storage";

const app = new App(
  { name: "Language Learning", version: "1.0.0" },
  {},
  { autoResize: false },
);

type Mode = "pronounce" | "flashcards" | "quiz" | "listening" | "sentence" | null;
let currentMode: Mode = null;
let currentArgs: any = null;

function detectMode(args: any): Mode {
  if (args?.cards) return "flashcards";
  if (args?.questions) return "quiz";
  if (args?.words && args?.title) return "listening";
  if (args?.exercises) return "sentence";
  if (args?.text) return "pronounce";
  return null;
}

function render() {
  const appEl = document.getElementById("app")!;
  // Each renderer receives: (container, args, app)
  // ... mode switch based on currentMode ...

  requestAnimationFrame(() => {
    const w = Math.max(appEl.scrollWidth, 100);
    const h = Math.max(appEl.scrollHeight, 24);
    app.sendSizeChanged({ width: w + 16, height: h + 16 });
  });
}

// Streaming preview
let renderTimer: ReturnType<typeof setTimeout> | null = null;

app.ontoolinputpartial = (params: any) => {
  const args = params.arguments;
  if (!args) return;
  currentMode = detectMode(args);
  currentArgs = args;
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, 150);
};

app.ontoolinput = (params: any) => {
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

app.ontoolcancelled = () => { speechSynthesis.cancel(); };
app.onerror = console.error;

function handleHostContext(ctx: any) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
  app.sendSizeChanged({ width: 600, height: 40 });
});

export { app };
```

## Worker Registration (worker.ts)

```typescript
import { createMcpHandler } from "agents/mcp";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import html from "./dist/mcp-app.html";
import icon from "./icon.svg";

function createServer(baseUrl: string): McpServer {
  const server = new McpServer({
    name: "Language Learning",
    version: "1.0.0",
    icons: [
      { src: `${baseUrl}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
    ],
  });

  const resourceUri = "ui://language-learning/mcp-app.html";
  const uiMeta = { _meta: { ui: { resourceUri } } };

  // 1. Pronounce (existing, unchanged)
  registerAppTool(server, "pronounce", {
    title: "Pronounce",
    description:
      "Render rich text with inline pronunciation buttons. " +
      "Write your FULL response in the `text` param using markdown. " +
      "Wrap each pronounceable word/phrase in double curly braces: {{bonjour}}.\n\n" +
      "Example: \"In French, {{bonjour}} means hello and {{merci}} means thank you.\"",
    inputSchema: {
      text: z.string().describe("Full markdown response with {{word}} markers"),
      language: z.string().describe("BCP 47 language tag (e.g. fr-FR, ja-JP)"),
    },
    ...uiMeta,
  }, async ({ text, language }) => {
    const words = [...text.matchAll(/\{\{(.+?)\}\}/g)].map(m => m[1]);
    return {
      content: [{ type: "text", text: words.length ? `Pronounced: ${words.join(", ")} (${language})` : text }],
      _meta: { viewUUID: crypto.randomUUID() },
    };
  });

  // 2. Flashcards
  registerAppTool(server, "flashcards", {
    title: "Flashcards",
    description:
      "Render an interactive flashcard deck for language learning. " +
      "Each card has a front (target language) and back (translation). " +
      "User flips cards and self-rates difficulty. TTS pronunciation on front. " +
      "The widget does NOT check answers. It sends all user ratings back via " +
      "updateModelContext when complete. You then evaluate performance.",
    inputSchema: {
      deckTitle: z.string().describe("Title of the flashcard deck"),
      language: z.string().describe("BCP 47 language tag for TTS"),
      cards: z.array(z.object({
        front: z.string().describe("Word/phrase in target language"),
        back: z.string().describe("Translation or definition"),
        hint: z.string().optional().describe("Optional hint"),
        example: z.string().optional().describe("Example sentence"),
      })).describe("Array of flashcards"),
    },
    ...uiMeta,
  }, async ({ deckTitle, cards }) => ({
    content: [{ type: "text", text: `Flashcard deck "${deckTitle}" with ${cards.length} cards` }],
    _meta: { viewUUID: crypto.randomUUID() },
  }));

  // 3. Quiz
  registerAppTool(server, "quiz", {
    title: "Quiz",
    description:
      "Render an interactive multiple-choice quiz. Shows one question at a time " +
      "with 2-4 options. The widget does NOT check answers or show correct/incorrect. " +
      "It collects all user choices and sends them back via updateModelContext. " +
      "You then evaluate which answers were correct and provide feedback.",
    inputSchema: {
      title: z.string().describe("Quiz title"),
      language: z.string().describe("BCP 47 language tag for TTS"),
      questions: z.array(z.object({
        prompt: z.string().describe("The question text"),
        options: z.array(z.string()).describe("2-4 answer choices"),
      })).describe("Array of quiz questions"),
    },
    ...uiMeta,
  }, async ({ title, questions }) => ({
    content: [{ type: "text", text: `Quiz "${title}" with ${questions.length} questions` }],
    _meta: { viewUUID: crypto.randomUUID() },
  }));

  // 4. Listening Test
  registerAppTool(server, "listening_test", {
    title: "Listening Test",
    description:
      "Render an interactive listening comprehension test. Plays a word via " +
      "browser TTS (the word is NOT shown to the user), user types what they heard. " +
      "The widget does NOT check spelling. It collects all typed responses and sends " +
      "them back via updateModelContext. You then evaluate accuracy and note patterns.",
    inputSchema: {
      title: z.string().describe("Test title"),
      language: z.string().describe("BCP 47 language tag for TTS"),
      words: z.array(z.object({
        word: z.string().describe("Word/phrase to pronounce via TTS (hidden from user)"),
        hint: z.string().optional().describe("Hint shown if user requests help"),
      })).describe("Array of listening items"),
    },
    ...uiMeta,
  }, async ({ title, words }) => ({
    content: [{ type: "text", text: `Listening test "${title}" with ${words.length} words` }],
    _meta: { viewUUID: crypto.randomUUID() },
  }));

  // 5. Sentence Builder
  registerAppTool(server, "sentence_builder", {
    title: "Sentence Builder",
    description:
      "Render an interactive sentence building exercise. Shows a translation as " +
      "prompt and shuffled word tiles. User taps tiles to arrange a sentence. " +
      "The widget does NOT check word order. It collects all user arrangements and " +
      "sends them back via updateModelContext. You then evaluate correctness.",
    inputSchema: {
      title: z.string().describe("Exercise title"),
      language: z.string().describe("BCP 47 language tag for TTS"),
      exercises: z.array(z.object({
        shuffledWords: z.array(z.string()).describe("Words in shuffled order"),
        translation: z.string().describe("Translation shown as prompt"),
        hint: z.string().optional().describe("Optional grammar hint"),
      })).describe("Array of sentence exercises"),
    },
    ...uiMeta,
  }, async ({ title, exercises }) => ({
    content: [{ type: "text", text: `Sentence builder "${title}" with ${exercises.length} exercises` }],
    _meta: { viewUUID: crypto.randomUUID() },
  }));

  // Register the shared UI resource
  registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    }),
  );

  return server;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    if (url.pathname === "/icon.svg") {
      return new Response(icon, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
      });
    }
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      const server = createServer(url.origin);
      return createMcpHandler(server)(request, env, ctx);
    }
    return new Response("Language Learning MCP - Interactive exercises for Claude.ai. Connect at /mcp", {
      status: 200, headers: { "Content-Type": "text/plain" },
    });
  },
} satisfies ExportedHandler<Env>;
```

## Build Configuration

### package.json

```json
{
  "name": "language-learning-mcp",
  "version": "1.0.0",
  "type": "module",
  "description": "Interactive language learning MCP App with flashcards, quizzes, listening tests, and sentence builders",
  "scripts": {
    "build:ui": "cross-env INPUT=mcp-app.html vite build",
    "dev": "cross-env NODE_ENV=development INPUT=mcp-app.html vite build --watch",
    "deploy": "npm run build:ui && wrangler deploy"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.24.0",
    "agents": "^0.7.7",
    "marked": "^17.0.5",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "cross-env": "^10.1.0",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0",
    "wrangler": "^4.75.0"
  }
}
```

### wrangler.toml

```toml
name = "language-learning-mcp"
main = "worker.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
```

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const input = process.env.INPUT;
if (!input) throw new Error("Set INPUT env var");

export default defineConfig({
  build: {
    rollupOptions: { input },
    outDir: "dist",
    emptyOutDir: false,
  },
  plugins: [viteSingleFile()],
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*", "worker.ts", "vite.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Implementation Order

### Phase 1: Scaffold + Pronounce (port existing)
1. Init repo, set up all config files
2. Create file structure with empty mode files
3. Extract TTS into `src/speech.ts`
4. Implement mode router in `src/mcp-app.ts`
5. Port pronounce renderer into `src/modes/pronounce.ts`
6. Port CSS into `src/mcp-app.css`
7. Register pronounce tool in `worker.ts`
8. `npm run build:ui && wrangler deploy`
9. Verify it works identically to pronounce-mcp in Claude.ai

### Phase 2: Quiz (simplest new mode)
1. Implement `src/modes/quiz.ts`:
   - Single question display with prompt text
   - Tappable option buttons
   - On tap: highlight selected option (neutral), advance to next question
   - Completion screen: "Quiz complete! Sending results to Claude..."
   - `updateModelContext()` with all question/answer pairs
   - `sendMessage()` to trigger Claude's evaluation
2. Add quiz CSS
3. Register quiz tool in `worker.ts`
4. Deploy and test: "Give me a French quiz about food vocabulary"

### Phase 3: Flashcards
1. Implement `src/modes/flashcards.ts`:
   - Card front with TTS button (reuse speech.ts)
   - Tap to flip (CSS flip animation), show back
   - 4 self-rating buttons: Again / Hard / Good / Easy
   - Rating advances to next card
   - Progress bar (X/total)
   - Completion screen, `updateModelContext()` with all ratings
2. Add flashcard CSS
3. Register tool, deploy
4. Test: "Create flashcards for French greetings"

### Phase 4: Listening Test
1. Implement `src/modes/listening.ts`:
   - Big play button (speaks word via TTS, word NOT shown)
   - Text input field
   - Submit button advances to next word
   - Optional hint button (shows hint if provided)
   - Completion screen, `updateModelContext()` with played-vs-typed pairs
2. Add CSS
3. Register tool, deploy
4. Test: "Give me a French listening test"

### Phase 5: Sentence Builder
1. Implement `src/modes/sentence.ts`:
   - Translation shown as prompt
   - Pool of tappable word tiles (shuffled)
   - Tap tile in pool -> moves to answer zone
   - Tap tile in answer zone -> moves back to pool
   - Submit button sends arrangement, advances to next exercise
   - Completion screen, `updateModelContext()` with all arrangements
2. Add CSS (tile styling, animations)
3. Register tool, deploy
4. Test: "Give me French sentence building exercises"

### Phase 6: Polish + Ship
1. Add localStorage position saving (storage.ts + viewUUID) to all modes
2. Add "Ask Claude" hint button to all exercise modes
3. Handle `ontoolinputpartial` gracefully (show loading/preview)
4. Test streaming in Claude.ai
5. Create demo GIF for README
6. Write README
7. Publish, add to awesome-mcp-servers

## CSS Guidelines

- All colors via host CSS variables: `var(--color-text-primary)`, `var(--color-background-primary)`, `var(--color-text-info)`, etc.
- Fonts: `var(--font-sans)`, `var(--font-mono)`
- Border radius: `var(--border-radius-sm)`, `var(--border-radius-md)`, `var(--border-radius-lg)`
- Font sizes: `var(--font-text-sm-size)`, `var(--font-text-md-size)`, etc.
- Animations: CSS-only (flip, slide, pulse)
- Touch-friendly: all tap targets >= 44px
- Widget width: 400-700px
- Background always transparent

## Mode Renderer Interface

Each mode exports one function:

```typescript
export function renderQuiz(
  container: HTMLElement,
  args: QuizArgs,
  app: App,
  savedState?: QuizState | null,
): void;
```

The mode owns its container's innerHTML entirely. It manages event listeners via event delegation. It calls `app.sendSizeChanged()` after rendering. It calls `saveWidgetState()` on user interactions.

## Key ext-apps APIs Used

```typescript
// Resize widget
app.sendSizeChanged({ width: number, height: number });

// Send exercise results to Claude (Claude sees this as context)
app.updateModelContext({
  content: [{ type: "text", text: "Quiz results: ..." }],
});

// Send a user message to Claude from the widget
app.sendMessage({
  role: "user",
  content: [{ type: "text", text: "I finished! How did I do?" }],
});

// Streaming preview
app.ontoolinputpartial = (params) => { /* preview */ };

// Final tool input
app.ontoolinput = (params) => { /* full render */ };

// Receive viewUUID for localStorage
app.ontoolresult = (result) => { /* result._meta?.viewUUID */ };
```