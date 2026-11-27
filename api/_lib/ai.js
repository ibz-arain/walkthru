// Which model answers. Gemini (Google AI Studio key) when GEMINI_API_KEY is set, otherwise OpenRouter. AGENT_MODEL picks the model.
// Both speak the OpenAI chat format, so only the address, key, model name, and a couple of options differ.
export const cleanKey = name => String(process.env[name] || '').trim().replace(new RegExp(`^${name}=`, 'i'), '').replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
export function agentProvider() {
  const model = String(process.env.AGENT_MODEL || '').trim();
  const gemini = cleanKey('GEMINI_API_KEY');
  if (gemini) return {
    name: 'Google', key: gemini, url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: model || 'gemini-flash-latest',
    options: { max_tokens: 8000, reasoning_effort: 'low' }, // its thinking counts toward max_tokens: keep it short and leave room for the reply
  };
  const openrouter = cleanKey('OPENROUTER_API_KEY');
  if (openrouter) return {
    name: 'OpenRouter', key: openrouter, url: 'https://openrouter.ai/api/v1/chat/completions',
    model: model || 'nvidia/nemotron-3.5-super-vl',
    options: { max_tokens: 3000, reasoning: { enabled: false } },
  };
  return null;
}
