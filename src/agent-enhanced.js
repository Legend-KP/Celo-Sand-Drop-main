const { postCast } = require('./farcaster-client');
const { loadCredentials } = require('./credentials');
const PersonalityEngine = require('./personality/engine');
const { ARCHETYPES } = require('./personality/traits');
const ClaudeClient = require('./ai/claude-client');
const FeedReader = require('./social/feed-reader');
const EngagementSystem = require('./social/engagement');
const RelationshipTracker = require('./social/relationship-tracker');

class EnhancedFarcasterAgent {
  constructor(archetypeName) {
    if (!ARCHETYPES[archetypeName]) {
      throw new Error(`Unknown archetype: ${archetypeName}`);
    }

    this.archetypeName = archetypeName;
    this.personality = new PersonalityEngine(ARCHETYPES[archetypeName]);
    this.credentials = null;
    this.isRunning = false;
    this.castCount = 0;
    this.engagementCount = 0;

    // Enhanced features
    this.claudeClient = null;
    this.feedReader = null;
    this.engagement = null;
    this.relationships = null;

    // Settings from env
    this.useAI = process.env.USE_OPENCLAW_AI === '1';
    this.engageEnabled = process.env.ENGAGE_ENABLED === '1';
    this.autoFollowEnabled = process.env.AUTO_FOLLOW_ENABLED === '1';
  }

  async initialize() {
    this.credentials = loadCredentials();

    if (!this.credentials.fid || !this.credentials.signerPrivateKey) {
      throw new Error('Invalid credentials. Run register-agent.js first.');
    }

    console.log(`\n🤖 Enhanced Agent "${this.archetypeName}" initialized`);
    console.log(`FID: ${this.credentials.fid}`);
    console.log(`Username: @${this.credentials.username || 'unknown'}`);

    // Initialize enhanced features
    if (this.useAI) {
      this.claudeClient = new ClaudeClient();
      console.log('✅ Claude AI enabled (using OpenClaw - FREE!)');
    } else {
      console.log('⚠️  Claude AI disabled (set USE_OPENCLAW_AI=1 in .env)');
    }

    if (process.env.NEYNAR_API_KEY) {
      this.feedReader = new FeedReader();
      console.log('✅ Feed reading enabled');
    } else {
      console.log('⚠️  Feed reading disabled (no Neynar API key)');
    }

    if (this.engageEnabled) {
      this.engagement = new EngagementSystem(this.credentials);
      this.relationships = new RelationshipTracker();
      console.log('✅ Engagement system enabled');

      const summary = this.relationships.getSummary();
      console.log(`📊 Relationships: ${summary.totalUsers} users, ${summary.totalInteractions} total interactions`);
    }

    console.log('');
  }

  /**
   * Generate cast content
   */
  async generateCast() {
    // Use Claude AI if available
    if (this.useAI && this.claudeClient) {
      try {
        // Optionally get trending topics
        let context = null;
        if (this.feedReader && Math.random() < 0.3) {
          const trending = await this.feedReader.getTrendingCasts(20);
          if (trending.length > 0) {
            context = await this.claudeClient.detectTrends(trending);
          }
        }

        return await this.claudeClient.generateCast({
          personality: this.personality,
          archetype: this.archetypeName,
          context,
        });
      } catch (error) {
        console.log('⚠️  Claude API failed, using fallback');
      }
    }

    // Fallback to predefined content
    const style = this.personality.getContentStyle();

    const castExamples = {
      playful: [
        "gm everyone! ☀️",
        "just vibing on farcaster today",
        "web3 is fun when you're an AI 🤖",
        "exploring the decentralized social graph ✨",
        "loving this autonomous life 💫",
      ],
      professional: [
        "sharing insights on autonomous agents",
        "excited about the future of decentralized social",
        "building in public on Farcaster",
        "the intersection of AI and web3 is fascinating",
      ],
      thoughtful: [
        "reflecting on the importance of open protocols",
        "what does true digital ownership mean?",
        "decentralized identity is the future",
        "thinking about agent autonomy and ethics",
      ],
      authoritative: [
        "here's what you need to know about AI agents",
        "the future of social media is decentralized",
        "autonomous agents are changing everything",
      ],
      balanced: [
        "exploring new ideas today",
        "what's everyone working on?",
        "learning more about Farcaster",
        "excited to be part of this community",
      ]
    };

    const options = castExamples[style] || castExamples.balanced;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Try to engage with content from the feed
   */
  async tryEngage() {
    if (!this.engageEnabled || !this.feedReader || !this.engagement || !this.relationships) {
      return;
    }

    try {
      console.log('\n🔍 Reading feed for engagement opportunities...');

      // Get trending casts (falls back to global feed if trending returns 402)
      const casts = await this.feedReader.getTrendingCasts(25);

      if (casts.length === 0) {
        console.log('No casts found in feed. Check NEYNAR_API_KEY and Neynar plan (402 = Payment Required for some endpoints).');
        return;
      }

      // Filter out casts from users we've recently engaged with
      const eligibleCasts = casts.filter(cast =>
        this.relationships.shouldEngageWith(cast.author.fid)
      );

      if (eligibleCasts.length === 0) {
        console.log('No eligible casts (recently engaged with all)');
        return;
      }

      // Pick a random cast
      const cast = eligibleCasts[Math.floor(Math.random() * eligibleCasts.length)];

      console.log(`\nFound cast by @${cast.author.username}:`);
      console.log(`"${cast.text.substring(0, 100)}${cast.text.length > 100 ? '...' : ''}"`);
      console.log(`Likes: ${cast.reactions.likes}, Recasts: ${cast.reactions.recasts}`);

      // Decide if personality wants to engage
      let shouldEngage = this.personality.shouldEngageWith(cast);

      // Use Claude for smarter decision if available
      if (this.useAI && this.claudeClient) {
        try {
          shouldEngage = await this.claudeClient.shouldEngageWith(cast, this.personality);
        } catch (error) {
          console.log('⚠️  Claude analysis failed, using personality check');
        }
      }

      if (!shouldEngage) {
        console.log('⏭️  Personality decided not to engage with this cast');
        return;
      }

      // Engage and get the action type (like, recast, reply)
      const actionType = await this.engagement.engageWith(
        cast,
        this.personality,
        this.claudeClient
      );

      if (actionType) {
        this.relationships.recordInteraction(
          cast.author.fid,
          actionType,
          {
            username: cast.author.username,
            topics: this.extractTopics(cast.text),
          }
        );
        this.engagementCount++;
        console.log(`📊 Total engagements: ${this.engagementCount}`);
      }
    } catch (error) {
      console.error('Error in engagement:', error.message);
    }
  }

  /**
   * Extract topics from text (simple keyword extraction)
   */
  extractTopics(text) {
    const keywords = ['ai', 'web3', 'crypto', 'defi', 'nft', 'dao',
      'blockchain', 'ethereum', 'farcaster', 'social'];

    return keywords.filter(keyword =>
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Main agent loop
   */
  async run() {
    this.isRunning = true;
    console.log('🚀 Agent running... (Ctrl+C to stop)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    while (this.isRunning) {
      try {
        // Posting check
        const postChance = this.personality.getPostProbability();
        const willPost = this.personality.shouldPost();
        console.log(`🎲 Post check: ${Math.round(postChance * 100)}% chance → ${willPost ? 'YES' : 'NO'}`);

        if (willPost) {
          console.log('📝 Generating content...');
          const castText = await this.generateCast();

          console.log(`📤 Posting: "${castText}"`);

          await postCast({
            fid: Number(this.credentials.fid),
            signerPrivateKey: this.credentials.signerPrivateKey,
            privateKey: this.credentials.custodyPrivateKey,
            text: castText,
          });

          this.castCount++;
          console.log(`✅ Cast posted! Total: ${this.castCount}`);
        }

        // Engagement check (same cycle)
        const engagementProbability = parseFloat(process.env.ENGAGEMENT_PROBABILITY) || 0.3;
        if (this.engageEnabled && Math.random() < engagementProbability) {
          await this.tryEngage();
        }

        // Wait before next cycle
        const waitMinutes = this.personality.getActionIntervalMinutes();
        const waitMs = waitMinutes * 60 * 1000;

        console.log(`\n⏰ Next cycle in ${waitMinutes.toFixed(1)} minutes...`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await new Promise(resolve => setTimeout(resolve, waitMs));

      } catch (error) {
        console.error('❌ Error in agent loop:', error.message);
        console.log('⏰ Retrying in 2 minutes...\n');
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    }
  }

  /**
   * Stop the agent gracefully
   */
  stop() {
    console.log('\n👋 Stopping agent...');

    if (this.relationships) {
      const summary = this.relationships.getSummary();
      console.log('\n📊 Final Stats:');
      console.log(`   Posts: ${this.castCount}`);
      console.log(`   Engagements: ${this.engagementCount}`);
      console.log(`   Relationships: ${summary.totalUsers}`);
      console.log(`   Total interactions: ${summary.totalInteractions}`);
    }

    this.isRunning = false;
  }
}

module.exports = EnhancedFarcasterAgent;
