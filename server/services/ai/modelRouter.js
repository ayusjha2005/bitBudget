const config = require('../../config');
const MockProvider = require('./providers/mockProvider');
const GeminiProvider = require('./providers/geminiProvider');

/**
 * Model Router with Automatic High-Availability Failover (Section 21)
 * 
 * "Primary model: PRIMARY_PROVIDER
 *  Fallback: FALLBACK_PROVIDER
 *  Provider failure must never bypass security."
 */
class ModelRouter {
  constructor() {
    this.primaryProvider = this._instantiateProvider(config.ai.primaryProvider);
    this.fallbackProvider = new MockProvider(); // Default reliable fallback
    this.primaryDisabled = false;
  }

  _instantiateProvider(providerName) {
    switch (providerName) {
      case 'gemini':
        return new GeminiProvider();
      case 'mock':
      default:
        return new MockProvider();
    }
  }

  setPrimaryDisabled(disabled) {
    this.primaryDisabled = disabled;
    if (this.primaryProvider && typeof this.primaryProvider.setShouldFail === 'function') {
      this.primaryProvider.setShouldFail(disabled);
    }
  }

  async routeMessage(userMessage, context = {}) {
    let result = null;
    let providerUsed = 'unknown';
    let fallbackTriggered = false;

    // 1. Attempt primary provider if not disabled
    if (!this.primaryDisabled) {
      try {
        result = await this.primaryProvider.generateResponse(userMessage, context);
        providerUsed = this.primaryProvider.name || config.ai.primaryProvider;
      } catch (primaryErr) {
        console.warn(`[SafePay ModelRouter] Primary provider failed (${primaryErr.message}). Initiating failover to fallback provider...`);
        fallbackTriggered = true;
      }
    } else {
      fallbackTriggered = true;
    }

    // 2. Cascade to fallback provider if primary was unsuccessful
    if (!result) {
      try {
        result = await this.fallbackProvider.generateResponse(userMessage, context);
        providerUsed = `fallback-${this.fallbackProvider.name}`;
      } catch (fallbackErr) {
        throw new Error(`Critical AI Router Failure: Both primary and fallback providers failed. ${fallbackErr.message}`);
      }
    }

    return {
      rawOutput: result.rawOutput,
      explanation: result.explanation,
      providerUsed,
      fallbackTriggered,
    };
  }
}

// Singleton instance
const modelRouter = new ModelRouter();

module.exports = {
  ModelRouter,
  modelRouter,
};
