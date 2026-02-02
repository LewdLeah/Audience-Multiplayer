// Audience Multiplayer - OpenRouter Module
// Handles LLM API calls and recursive merge logic
/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').Submission} Submission */
/** @typedef {import('./types.js').AIDContext} AIDContext */
import { OPENROUTER_API_URL, OPENROUTER_REFERER, OPENROUTER_TITLE } from './constants.js';
/**
 * Builds the system prompt for combining submissions.
 * @param {string} partyMemberName - Character name for the party member
 * @returns {string} The system prompt
 */
const buildSystemPrompt = (partyMemberName) => `You are helping combine multiple player suggestions into a single action for **${partyMemberName}** in a collaborative interactive fiction story.

Your task is to synthesize the submitted actions into ONE coherent third-person action that:
- Incorporates the best elements from each suggestion when possible
- Fits naturally with the story context and tone
- Maintains narrative consistency with established characters and setting
- Is concise (1-2 sentences maximum)

## Formatting Rules

- Write ONLY the action text, no explanations or commentary
- Do NOT begin with "${partyMemberName}" or any character name - the game engine adds that automatically
- Write in third person (e.g. "leaps forward and grabs the rope" not "${partyMemberName} leaps forward")
- Actions should flow naturally from the current story moment`;
/**
 * Calls OpenRouter API to generate a completion.
 * @param {Config} config - Must have openRouterApiKey set
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - The user prompt to send
 * @returns {Promise<string>} The generated text
 * @throws {Error} If API key missing or request fails
 */
export const callOpenRouter = async (config, systemPrompt, userPrompt) => {
  if (!config.openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouterApiKey}`,
      'HTTP-Referer': OPENROUTER_REFERER,
      'X-Title': OPENROUTER_TITLE
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
};
// Section types to skip (AI Instructions and Author's Note)
const SKIP_SECTIONS = ['instructions', 'authorsNote'];
/**
 * Extracts story context from AID context sections, mimicking AID's context assembly.
 * Excludes AI Instructions and Author's Note.
 * @param {AIDContext|null} context - The AID context
 * @returns {string} Extracted story context
 */
const extractStoryContext = (context) => {
  if (!context?.contextSections) {
    console.log('[OpenRouter] No contextSections available');
    return '';
  }
  const sections = context.contextSections;
  const filtered = sections.filter(s => !SKIP_SECTIONS.includes(s.type) && s.text);
  console.log('[OpenRouter] Extracting context:', sections.length, 'total,', filtered.length, 'after filter');
  if (filtered.length === 0 && sections.length > 0) {
    console.log('[OpenRouter] Sample section:', JSON.stringify(sections[0]));
  }
  return filtered
    .map(s => s.text.trim())
    .join('\n\n')
    .trim();
};
/**
 * Builds a user prompt for combining submissions.
 * @param {string} storyContext - The current story context from AID
 * @param {string|null} lastAIOutput - The most recent AI output (Previous)
 * @param {Submission[]} submissions - Submissions to combine
 * @param {string} partyMemberName - Character name for the party member
 * @returns {string} The formatted user prompt
 */
export const buildCombinePrompt = (storyContext, lastAIOutput, submissions, partyMemberName) => {
  const submissionList = submissions.map((s, i) => `${i + 1}. "${s.text}" (by ${s.user})`).join('\n');
  let prompt = `# Character: ${partyMemberName}\n\n`;
  // Build the full context with Most Recent at the end
  let fullContext = storyContext || '';
  if (lastAIOutput) {
    fullContext += `\n\nMost Recent:\n${lastAIOutput}`;
  }
  fullContext = fullContext.trim();
  if (fullContext) {
    prompt += `## Story Context\n\n\`\`\`\n${fullContext}\n\`\`\`\n\n`;
  }
  prompt += `## Player Submissions\n\n${submissionList}\n\n`;
  prompt += `## Task\n\n`;
  prompt += `Combine these ${submissions.length} suggestions into a single action for **${partyMemberName}**.`;
  prompt += ` Output ONLY the action text, do not prefix with the character name.`;
  return prompt;
};
/**
 * Debug info for the "Combined" call.
 * @typedef {Object} AICallDebugInfo
 * @property {string} systemPrompt - The system prompt used
 * @property {string} userPrompt - The user prompt sent
 * @property {string} response - The AI response
 * @property {string} model - Model used
 * @property {number} timestamp - When called
 */
/**
 * Recursively merges submissions using LLM, batching as needed.
 * @param {Config} config - User configuration with API key and partyMemberName
 * @param {AIDContext|null} context - Current AID context for story
 * @param {Submission[]} submissions - Submissions to merge
 * @param {string|null} lastAIOutput - Most recent AI output from AID
 * @returns {Promise<{result: string, debugInfo: AICallDebugInfo|null}>} The final merged action and debug info
 */
export const recursiveMerge = async (config, context, submissions, lastAIOutput = null) => {
  // Base case: single submission
  if (submissions.length === 1) {
    return { result: submissions[0].text, debugInfo: null };
  }
  const storyContext = extractStoryContext(context);
  const partyMemberName = config.partyMemberName || 'the party member';
  const systemPrompt = buildSystemPrompt(partyMemberName);
  // Calculate dynamic batch size based on context budget
  // Estimate ~50 tokens per submission, aim for ~16000 tokens per batch
  const tokensPerSubmission = 50;
  const targetBatchTokens = 16000;
  const batchSize = Math.max(3, Math.floor(targetBatchTokens / tokensPerSubmission));
  // If we can fit all in one batch, do it directly
  if (submissions.length <= batchSize) {
    const userPrompt = buildCombinePrompt(storyContext, lastAIOutput, submissions, partyMemberName);
    const result = await callOpenRouter(config, systemPrompt, userPrompt);
    return {
      result,
      debugInfo: {
        systemPrompt,
        userPrompt,
        response: result,
        model: config.model,
        timestamp: Date.now()
      }
    };
  }
  // Split into batches and merge each
  const batches = [];
  for (let i = 0; i < submissions.length; i += batchSize) {
    batches.push(submissions.slice(i, i + batchSize));
  }
  console.log('[Merge] Splitting', submissions.length, 'submissions into', batches.length, 'batches of ~' + batchSize);
  // Merge each batch in parallel
  const intermediateResults = await Promise.all(
    batches.map(async (batch, idx) => {
      const userPrompt = buildCombinePrompt(storyContext, lastAIOutput, batch, partyMemberName);
      const result = await callOpenRouter(config, systemPrompt, userPrompt);
      console.log('[Merge] Batch', idx + 1, 'result:', result.substring(0, 50));
      return { user: `Batch${idx + 1}`, text: result, timestamp: Date.now(), votes: new Set() };
    })
  );
  // Recursively merge intermediate results (no lastAIOutput for recursive calls)
  return await recursiveMerge(config, context, intermediateResults, null);
};
