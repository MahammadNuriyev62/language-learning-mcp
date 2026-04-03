import { createMcpHandler } from "agents/mcp";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import html from "./dist/mcp-app.html";
import icon from "./icon.svg";

interface Env {}

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

  // 1. Pronounce
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

  // Register shared UI resource
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
