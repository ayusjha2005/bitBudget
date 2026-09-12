const config = require('../../../config');
const { SYSTEM_PROMPT } = require('../promptTemplates');

/**
 * Gemini Provider Adapter
 * Integrates with Google Gen AI API when GEMINI_API_KEY is available.
 */
class GeminiProvider {
  constructor() {
    this.name = 'gemini-1.5-pro';
    this.apiKey = config.ai.geminiApiKey;
  }

  async generateResponse(userMessage, context = {}) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured. Failover required.');
    }

    try {
      // Standard HTTP fetch to Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Message: ${userMessage}` }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        rawOutput: rawText,
        explanation: 'Extracted financial proposal via Gemini API.',
      };
    } catch (err) {
      throw new Error(`Gemini provider error: ${err.message}`);
    }
  }
}

module.exports = GeminiProvider;
