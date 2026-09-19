const crypto = require("crypto");
const OpenAI = require("openai");
const { createClient } = require("redis");

/**
 * PROVENANCE CORRECTIONS (found during Phase 7, updates two Phase 0 notes):
 *
 * 1. Redis is NOT dead config, contrary to the Phase 0 contract's tentative
 *    note. It's used here for LLM response caching — Phase 0 just hadn't
 *    read this file yet. Ported faithfully below, including the "fail open"
 *    behavior: if Redis is unreachable, caching is silently skipped rather
 *    than erroring the request.
 *
 * 2. Despite the README and config.py advertising "OpenAI GPT-4o or Google
 *    Gemini", this file only ever instantiates an OpenAI client. There is no
 *    Gemini call anywhere in llm_service.py — the multi-provider claim is
 *    aspirational, not implemented. Ported as OpenAI-only to match actual
 *    behavior; if Gemini support is wanted, that's new functionality to
 *    scope deliberately, not a gap to silently "restore".
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const CACHE_TTL_SECONDS = 3600; // matches Python's setex(..., 3600, ...)

// The SDK retries 429/5xx responses with exponential backoff (default 2
// retries). Providers such as Gemini return short "high demand" 503 spikes,
// so allow a couple more before surfacing the error to the student.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "4", 10),
});

let redisClient = null;
let redisConnecting = null;

async function getRedis() {
  if (redisClient) return redisClient;
  if (!redisConnecting) {
    redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
    redisClient.on("error", () => {
      // Swallow — every call site below already wraps Redis use in try/catch,
      // this just stops unhandled 'error' events from crashing the process.
    });
    redisConnecting = redisClient.connect();
  }
  await redisConnecting;
  return redisClient;
}

function cacheKey(prompt, systemPrompt = "") {
  const content = `${systemPrompt}:${prompt}`;
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return `llm_cache:${hash}`;
}

/**
 * Ports generate(prompt, system_prompt, temperature, max_tokens, use_cache, json_mode).
 */
async function generate(
  prompt,
  {
    systemPrompt = "",
    temperature = 0.7,
    maxTokens = 2000,
    useCache = true,
    jsonMode = false,
  } = {}
) {
  const key = cacheKey(prompt, systemPrompt);

  if (useCache) {
    try {
      const r = await getRedis();
      const cached = await r.get(key);
      if (cached) return cached;
    } catch {
      // Redis unavailable — continue without cache, same as Python's bare except+pass
    }
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const params = {
    model: OPENAI_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) params.response_format = { type: "json_object" };

  const response = await openai.chat.completions.create(params);
  const result = response.choices[0].message.content;

  if (useCache) {
    try {
      const r = await getRedis();
      await r.setEx(key, CACHE_TTL_SECONDS, result);
    } catch {
      // same fail-open behavior on write
    }
  }

  return result;
}

/**
 * Ports generate_stream — an async generator, matching the Python
 * AsyncGenerator usage. Consumers (Phase 10's SSE chat route) can
 * `for await (const chunk of generateStream(...))`.
 */
async function* generateStream(
  prompt,
  { systemPrompt = "", temperature = 0.7, maxTokens = 2000 } = {}
) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const stream = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Ports generate_json — including the exact fallback: if json.loads fails,
 * try slicing between the first "{" and last "}" before giving up.
 */
async function generateJson(
  prompt,
  { systemPrompt = "", temperature = 0.3, maxTokens = 4000 } = {}
) {
  const result = await generate(prompt, {
    systemPrompt,
    temperature,
    maxTokens,
    useCache: true,
    jsonMode: true,
  });

  try {
    return JSON.parse(result);
  } catch {
    const start = result.indexOf("{");
    const end = result.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(result.slice(start, end)); // lets a genuine parse error throw, same as Python
    }
    throw new Error(`Failed to parse LLM response as JSON: ${result.slice(0, 200)}`);
  }
}

module.exports = { generate, generateStream, generateJson, cacheKey };
