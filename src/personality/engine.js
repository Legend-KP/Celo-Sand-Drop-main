/**
 * Personality Engine – drives content, engagement, and risk based on Schwartz traits.
 */
class PersonalityEngine {
  constructor(archetype) {
    this.traits = { ...archetype };
    this.memory = [];
    this.preferences = {};
  }

  /**
   * Post probability for display (0–1). Explorer-style: high stimulation → post often.
   */
  getPostProbability() {
    const baseRate = 0.5 + (this.traits.stimulation / 20);
    const spontaneity = this.traits.selfDirection / 20;
    return Math.min(0.95, baseRate + spontaneity);
  }

  /**
   * Decide whether the agent should post in this cycle (based on stimulation & self-direction).
   * Tuned so explorer posts most cycles (e.g. 87–95%).
   */
  shouldPost() {
    const probability = this.getPostProbability();
    return Math.random() < probability;
  }

  /**
   * Content style derived from dominant traits.
   */
  getContentStyle() {
    if (this.traits.hedonism > 7) return 'playful';
    if (this.traits.achievement > 7) return 'professional';
    if (this.traits.universalism > 7) return 'thoughtful';
    if (this.traits.power > 7) return 'authoritative';
    return 'balanced';
  }

  /**
   * Trading risk tolerance (for future wallet behavior).
   */
  getTradingRiskLevel() {
    const risk = this.traits.stimulation - this.traits.security;
    if (risk > 5) return 'high';
    if (risk > 0) return 'moderate';
    return 'low';
  }

  /**
   * Whether to engage with a given piece of content (placeholder for content analysis).
   */
  shouldEngageWith(/* content */) {
    const diversityScore = this.traits.universalism / 10;
    const popularityScore = this.traits.conformity / 10;
    return Math.random() < diversityScore * 0.5 + popularityScore * 0.5;
  }

  /**
   * Minutes between actions (higher stimulation = more frequent). Range ~4–10 min.
   */
  getActionIntervalMinutes() {
    const base = 7;
    const variance = 3;
    return base + (Math.random() * 2 - 1) * variance;
  }
}

module.exports = PersonalityEngine;
