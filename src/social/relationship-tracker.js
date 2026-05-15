const fs = require('fs');
const path = require('path');

class RelationshipTracker {
  constructor(dataPath = './data/relationships.json') {
    this.dataPath = dataPath;
    this.relationships = this.load();
  }

  /**
   * Load relationships from file
   */
  load() {
    try {
      // Ensure data directory exists
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading relationships:', error.message);
      return {};
    }
  }

  /**
   * Save relationships to file
   */
  save() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.dataPath,
        JSON.stringify(this.relationships, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving relationships:', error.message);
    }
  }

  /**
   * Record an interaction with a user
   */
  recordInteraction(fid, type, data = {}) {
    if (!this.relationships[fid]) {
      this.relationships[fid] = {
        fid,
        username: data.username || null,
        firstSeen: new Date().toISOString(),
        lastInteraction: new Date().toISOString(),
        interactions: {
          likes: 0,
          recasts: 0,
          replies: 0,
        },
        score: 0,
        topics: [],
        notes: [],
      };
    }

    const user = this.relationships[fid];

    // Update interaction count
    if (type === 'like') user.interactions.likes++;
    if (type === 'recast') user.interactions.recasts++;
    if (type === 'reply') user.interactions.replies++;

    // Update last interaction
    user.lastInteraction = new Date().toISOString();

    // Update username if provided
    if (data.username) user.username = data.username;

    // Track topics
    if (data.topics) {
      data.topics.forEach(topic => {
        if (!user.topics.includes(topic)) {
          user.topics.push(topic);
        }
      });
    }

    // Calculate relationship score
    user.score = this.calculateScore(user);

    this.save();
  }

  /**
   * Calculate relationship strength score
   */
  calculateScore(user) {
    const { likes, recasts, replies } = user.interactions;

    // Weight different interaction types
    const score =
      (likes * 1) +
      (recasts * 2) +
      (replies * 5);

    // Factor in recency
    const daysSinceLastInteraction = this.daysSince(user.lastInteraction);
    const recencyBonus = Math.max(0, 1 - (daysSinceLastInteraction / 30));

    return Math.round(score * (1 + recencyBonus));
  }

  /**
   * Get top relationships
   */
  getTopRelationships(limit = 10) {
    return Object.values(this.relationships)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get users by topic
   */
  getUsersByTopic(topic) {
    return Object.values(this.relationships)
      .filter(user => user.topics.includes(topic))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Check if should engage with user (avoid spam)
   */
  shouldEngageWith(fid) {
    const user = this.relationships[fid];

    if (!user) return true; // New user, always engage

    // Don't spam the same user
    const hoursSinceLastInteraction = this.hoursSince(user.lastInteraction);
    if (hoursSinceLastInteraction < 2) {
      return false; // Wait at least 2 hours
    }

    // Engage more with high-score users
    const engagementProbability = Math.min(0.8, user.score / 100);
    return Math.random() < engagementProbability;
  }

  /**
   * Get relationship summary
   */
  getSummary() {
    const users = Object.values(this.relationships);

    return {
      totalUsers: users.length,
      totalInteractions: users.reduce((sum, u) =>
        sum + u.interactions.likes + u.interactions.recasts + u.interactions.replies, 0
      ),
      topUsers: this.getTopRelationships(5),
      averageScore: users.length > 0
        ? Math.round(users.reduce((sum, u) => sum + u.score, 0) / users.length)
        : 0,
    };
  }

  /**
   * Helper: Days since date
   */
  daysSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return (now - date) / (1000 * 60 * 60 * 24);
  }

  /**
   * Helper: Hours since date
   */
  hoursSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return (now - date) / (1000 * 60 * 60);
  }
}

module.exports = RelationshipTracker;
