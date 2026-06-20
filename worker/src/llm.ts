import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Config } from "./config.js";
import type { Category, RawItem } from "./types.js";
import { truncateWords } from "./util.js";

/**
 * Turns selected raw items into clean 2–3 sentence, text-only summaries.
 * Pluggable so the model is a "decide later" choice: with no key it falls back
 * to the article's own RSS text, so the worker runs today with zero credentials.
 */
export interface Summarizer {
  readonly label: string;
  summarize(category: Category, items: RawItem[]): Promise<string[]>;
}

function fallbackSummaries(items: RawItem[]): string[] {
  return items.map((it) =>
    it.snippet ? truncateWords(it.snippet, 55) : `${it.title}.`,
  );
}

const SYSTEM_PROMPT = [
  "You write concise, factual news summaries for a text-first news reader used by a deaf reader.",
  "For each article you are given a title and a short source snippet.",
  "Write a 2-3 sentence plain-text summary of what happened and why it matters.",
  "Rules: no audio/video references ('watch', 'listen to the clip'); no marketing fluff;",
  "do not invent facts beyond the title and snippet; never include URLs.",
].join(" ");

function buildPrompt(category: Category, items: RawItem[]): string {
  const lines = items.map(
    (it, i) => `${i}. [${it.source}] ${it.title}\n   snippet: ${it.snippet || "(none)"}`,
  );
  return [
    `Category: ${category}`,
    "Summarize each of the following articles.",
    'Respond ONLY with a JSON array of objects: [{"i": <index>, "summary": "<text>"}].',
    "",
    lines.join("\n"),
  ].join("\n");
}

/** Pull a JSON array out of a model response, tolerating code fences / prose. */
function parseSummaries(text: string, count: number): string[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]) as Array<{ i: number; summary: string }>;
    const out: string[] = new Array(count).fill("");
    for (const entry of arr) {
      if (typeof entry.i === "number" && entry.i >= 0 && entry.i < count) {
        out[entry.i] = String(entry.summary ?? "").trim();
      }
    }
    return out;
  } catch {
    return null;
  }
}

class NoneSummarizer implements Summarizer {
  readonly label = "none (RSS text)";
  async summarize(_category: Category, items: RawItem[]): Promise<string[]> {
    return fallbackSummaries(items);
  }
}

class AnthropicSummarizer implements Summarizer {
  readonly label: string;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.label = `anthropic ${model}`;
  }

  async summarize(category: Category, items: RawItem[]): Promise<string[]> {
    if (items.length === 0) return [];
    const fallback = fallbackSummaries(items);
    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPrompt(category, items) }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const parsed = parseSummaries(text, items.length);
      if (!parsed) return fallback;
      return parsed.map((s, i) => s || fallback[i]!);
    } catch (err) {
      console.warn(`  ! anthropic summarize failed for ${category}: ${String(err).slice(0, 120)}`);
      return fallback;
    }
  }
}

class OpenAISummarizer implements Summarizer {
  readonly label: string;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.label = `openai ${model}`;
  }

  async summarize(category: Category, items: RawItem[]): Promise<string[]> {
    if (items.length === 0) return [];
    const fallback = fallbackSummaries(items);
    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(category, items) },
        ],
      });
      const text = resp.choices[0]?.message?.content ?? "";
      const parsed = parseSummaries(text, items.length);
      if (!parsed) return fallback;
      return parsed.map((s, i) => s || fallback[i]!);
    } catch (err) {
      console.warn(`  ! openai summarize failed for ${category}: ${String(err).slice(0, 120)}`);
      return fallback;
    }
  }
}

export function createSummarizer(config: Config): Summarizer {
  const { provider, anthropicApiKey, anthropicModel, openaiApiKey, openaiModel } = config.llm;
  if (provider === "anthropic" && anthropicApiKey) {
    return new AnthropicSummarizer(anthropicApiKey, anthropicModel);
  }
  if (provider === "openai" && openaiApiKey) {
    return new OpenAISummarizer(openaiApiKey, openaiModel);
  }
  return new NoneSummarizer();
}
