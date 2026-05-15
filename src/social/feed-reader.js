const fetch = require('node-fetch');

class FeedReader {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.NEYNAR_API_KEY;
    this.baseUrl = 'https://api.neynar.com/v2';
  }

  /**
   * Get recent casts from the global feed
   */
  async getGlobalFeed(limit = 25) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/feed?feed_type=filter&filter_type=global_trending&limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return this.formatCasts(data.casts || []);

    } catch (error) {
      console.error('Error fetching global feed:', error.message);
      return [];
    }
  }

  /**
   * Get casts from users you follow
   */
  async getFollowingFeed(fid, limit = 25) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/feed?feed_type=following&fid=${fid}&limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return this.formatCasts(data.casts || []);

    } catch (error) {
      console.error('Error fetching following feed:', error.message);
      return [];
    }
  }

  /**
   * Get popular/trending casts.
   * On 402 (Payment Required), falls back to global feed so engagement can still work.
   */
  async getTrendingCasts(limit = 25) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/feed/trending?limit=${limit}&time_window=24h`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (response.status === 402) {
        console.warn('⚠️  Neynar 402 (Payment Required) for trending feed. Using global feed fallback for engagement.');
        return await this.getGlobalFeed(limit);
      }

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return this.formatCasts(data.casts || []);

    } catch (error) {
      if (error.message.includes('402')) {
        console.warn('⚠️  Neynar 402 (Payment Required). Using global feed fallback for engagement.');
        return await this.getGlobalFeed(limit);
      }
      console.error('Error fetching trending casts:', error.message);
      return [];
    }
  }

  /**
   * Get casts by a specific user
   */
  async getUserCasts(fid, limit = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/feed/user/${fid}?limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return this.formatCasts(data.casts || []);

    } catch (error) {
      console.error('Error fetching user casts:', error.message);
      return [];
    }
  }

  /**
   * Search for casts by keyword
   */
  async searchCasts(query, limit = 20) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return this.formatCasts(data.casts || []);

    } catch (error) {
      console.error('Error searching casts:', error.message);
      return [];
    }
  }

  /**
   * Get suggested users to follow
   */
  async getSuggestedUsers(fid, limit = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/farcaster/user/power?viewer_fid=${fid}&limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return data.result?.users || [];

    } catch (error) {
      console.error('Error fetching suggested users:', error.message);
      return [];
    }
  }

  /**
   * Format casts into a consistent structure
   */
  formatCasts(casts) {
    return casts.map(cast => ({
      hash: cast.hash,
      text: cast.text,
      author: {
        fid: cast.author?.fid,
        username: cast.author?.username,
        displayName: cast.author?.display_name,
        followerCount: cast.author?.follower_count,
      },
      timestamp: cast.timestamp,
      reactions: {
        likes: cast.reactions?.likes_count || 0,
        recasts: cast.reactions?.recasts_count || 0,
        replies: cast.replies?.count || 0,
      },
      embeds: cast.embeds || [],
      mentions: cast.mentions || [],
      parentHash: cast.parent_hash,
      parentAuthor: cast.parent_author,
    }));
  }

  /**
   * Filter casts by engagement threshold
   */
  filterByEngagement(casts, minLikes = 5) {
    return casts.filter(cast =>
      (cast.reactions.likes || 0) >= minLikes
    );
  }

  /**
   * Filter out casts from users you're already following
   */
  filterUnfollowed(casts, followingFids = []) {
    return casts.filter(cast =>
      !followingFids.includes(cast.author.fid)
    );
  }
}

module.exports = FeedReader;
