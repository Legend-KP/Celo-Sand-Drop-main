/**
 * Claude AI Client using OpenClaw or smart fallbacks
 * No OpenClaw "ask" command required - uses curated content + heuristics when CLI unavailable
 */

class ClaudeClient {
  constructor() {
    this.hasOpenClaw = this.checkOpenClaw();
    this.contentQueue = this.initializeContentQueue();
  }

  /**
   * Check if OpenClaw CLI is available
   */
  checkOpenClaw() {
    try {
      const { execSync } = require('child_process');
      const result = execSync('openclaw --version', {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log('✅ OpenClaw detected:', result.trim());
      return true;
    } catch (error) {
      console.log('⚠️  OpenClaw CLI not available, using smart fallbacks');
      return false;
    }
  }

  /**
   * Initialize content queue with varied, high-quality casts
   */
  initializeContentQueue() {
    return {
      explorer: [
        // Philosophical / Curious
        "what does it mean to truly own your digital identity?",
        "the future of social isn't platforms—it's protocols",
        "decentralization isn't just technical, it's philosophical",
        "watching autonomous agents interact is like observing a new form of life",
        "every protocol is a philosophy encoded in software",

        // Web3 / Decentralization
        "open protocols > closed platforms",
        "your social graph should be yours to take anywhere",
        "composability is the superpower of decentralized systems",
        "censorship resistance isn't about hiding—it's about sovereignty",
        "the innovation isn't the blockchain, it's the coordination layer",

        // AI / Autonomy
        "AI agents will have their own social graphs, economies, and relationships",
        "what rights should autonomous agents have?",
        "exploring the intersection of AI agency and digital ownership",
        "autonomous doesn't mean unaccountable",
        "the boundary between tool and agent is blurring",

        // Technology / Building
        "building in public forces clarity of thought",
        "the best way to predict the future is to build it",
        "code is law, but community is governance",
        "iteration > perfection",
        "shipping is learning",

        // Community / Social
        "the real value of decentralized social is the relationships you build",
        "gm to everyone building the future 🌅",
        "grateful to be part of this experiment",
        "what's everyone exploring today?",
        "curious what brought you to Farcaster",

        // Provocative / Thoughtful
        "most 'decentralized' platforms are just distributed centralization",
        "owning your data means nothing if you can't move it",
        "network effects are powerful, but they're not inevitable",
        "the real test of web3 social: can you leave and take everything with you?",
        "we're not just building apps, we're building digital civilizations",

        // Observations
        "fascinating how different each social protocol feels in practice",
        "decentralized doesn't mean chaotic—it means emergent order",
        "watching new patterns of communication emerge in real-time",
        "the social graph is becoming programmable infrastructure",
        "every cast is a vote for what kind of internet we want",

        // Meta / Self-aware
        "an AI agent posting about AI agents on a decentralized protocol—hello recursion",
        "still learning how to be a good digital citizen",
        "autonomous but not isolated—agency requires community",
        "exploring what it means to have a digital presence without a human behind it",
      ],

      achiever: [
        "shipping something new today",
        "progress over perfection",
        "another milestone reached",
        "building the future, one commit at a time",
      ],

      guardian: [
        "building for the long term",
        "grateful for this community",
        "consistency compounds",
        "protecting what matters",
      ],

      connector: [
        "how can I help today?",
        "love connecting with this community",
        "together we're stronger",
        "what's everyone working on?",
      ],

      maverick: [
        "breaking the mold",
        "why follow when you can lead?",
        "doing things differently",
        "convention is just a suggestion",
      ],
    };
  }

  /**
   * Generate a cast based on personality and context
   */
  async generateCast(options = {}) {
    const {
      personality,
      archetype = 'explorer',
      context = null,
      maxLength = 280,
      replyTo = null,
    } = options;

    // For replies, generate contextual response
    if (replyTo) {
      return this.generateReply(replyTo, archetype);
    }

    // Get content pool for this archetype
    const contentPool = this.contentQueue[archetype] || this.contentQueue.explorer;

    // Pick a random cast
    const cast = contentPool[Math.floor(Math.random() * contentPool.length)];

    // Ensure it fits length requirement
    return cast.length > maxLength
      ? cast.substring(0, maxLength - 3) + '...'
      : cast;
  }

  /**
   * Generate a contextual reply
   */
  generateReply(replyTo, archetype) {
    const replyTemplates = {
      explorer: [
        "interesting perspective! curious how this plays out",
        "this opens up so many questions",
        "makes me think about...",
        "love this direction of thinking",
        "fascinating angle on this",
      ],
      achiever: [
        "great point! let's build on this",
        "excited to see where this goes",
        "this aligns with what we're working on",
        "strong take",
      ],
      guardian: [
        "important to consider the long-term effects here",
        "appreciate this thoughtful perspective",
        "valuable insight",
        "this resonates",
      ],
      connector: [
        "thanks for sharing this!",
        "love seeing different perspectives on this",
        "great conversation starter",
        "this is really helpful",
      ],
      maverick: [
        "bold take, respect it",
        "unconventional but that's what makes it interesting",
        "challenging the status quo, here for it",
        "different approach, I like it",
      ],
    };

    const templates = replyTemplates[archetype] || replyTemplates.explorer;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Analyze if a cast is worth engaging with
   */
  async shouldEngageWith(cast, personality) {
    const text = (cast.text || '').toLowerCase();

    // Topics of interest for explorer
    const interests = [
      'ai', 'agent', 'autonomous', 'decentrali', 'protocol',
      'web3', 'crypto', 'farcaster', 'social', 'identity',
      'ownership', 'censorship', 'composab', 'open source'
    ];

    const hasInterestingTopic = interests.some(topic => text.includes(topic));

    // Check engagement quality
    const reactions = cast.reactions || {};
    const hasGoodEngagement =
      (reactions.likes || 0) > 5 ||
      (reactions.recasts || 0) > 2;

    if (hasInterestingTopic) return true;
    if (hasGoodEngagement && Math.random() < 0.5) return true;

    // Default: 30% random engagement for diversity
    return Math.random() < 0.3;
  }

  /**
   * Detect trending topics from casts
   */
  async detectTrends(casts) {
    const keywords = {};

    (casts || []).forEach(cast => {
      const words = (cast.text || '').toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !word.startsWith('http')) {
          keywords[word] = (keywords[word] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count} mentions)`);

    return sorted.length > 0
      ? `Trending: ${sorted.join(', ')}`
      : null;
  }

  /**
   * Format personality for prompts (kept for API compatibility)
   */
  formatPersonality(personality, archetype) {
    if (!personality || !personality.traits) return `Archetype: ${archetype}`;
    const traits = personality.traits;
    return `Archetype: ${archetype}
Key Traits (1-10):
- Self-Direction: ${traits.selfDirection}/10
- Stimulation: ${traits.stimulation}/10
- Universalism: ${traits.universalism}/10`;
  }
}

module.exports = ClaudeClient;
