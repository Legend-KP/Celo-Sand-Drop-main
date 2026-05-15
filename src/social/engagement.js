const { postReaction, postReply } = require('../farcaster-client');

class EngagementSystem {
  constructor(credentials) {
    this.fid = credentials.fid;
    this.signerPrivateKey = credentials.signerPrivateKey;
    this.custodyPrivateKey = credentials.custodyPrivateKey;
  }

  /**
   * Like a cast
   */
  async likeCast(castHash, targetFid) {
    console.log(`❤️  Liking cast ${castHash.slice(0, 10)}...`);

    try {
      await postReaction({
        fid: this.fid,
        signerPrivateKey: this.signerPrivateKey,
        privateKey: this.custodyPrivateKey,
        targetFid,
        targetHash: castHash,
        type: 'like',
      });
      console.log('✅ Like submitted');
      return true;
    } catch (error) {
      console.error('Error liking cast:', error.message);
      return false;
    }
  }

  /**
   * Recast (retweet equivalent)
   */
  async recast(castHash, targetFid) {
    console.log(`🔄 Recasting ${castHash.slice(0, 10)}...`);

    try {
      await postReaction({
        fid: this.fid,
        signerPrivateKey: this.signerPrivateKey,
        privateKey: this.custodyPrivateKey,
        targetFid,
        targetHash: castHash,
        type: 'recast',
      });
      console.log('✅ Recast submitted');
      return true;
    } catch (error) {
      console.error('Error recasting:', error.message);
      return false;
    }
  }

  /**
   * Reply to a cast
   */
  async reply(castHash, targetFid, replyText) {
    console.log(`💬 Replying to ${castHash.slice(0, 10)}...`);
    console.log(`   "${replyText}"`);

    try {
      await postReply({
        fid: this.fid,
        signerPrivateKey: this.signerPrivateKey,
        privateKey: this.custodyPrivateKey,
        parentFid: targetFid,
        parentHash: castHash,
        text: replyText,
      });
      console.log('✅ Reply submitted');
      return true;
    } catch (error) {
      console.error('Error replying:', error.message);
      return false;
    }
  }

  /**
   * Follow a user (placeholder - Farcaster follow protocol may need additional implementation)
   */
  async followUser(targetFid) {
    console.log(`👤 Following user ${targetFid}...`);
    console.log('⚠️  Follow feature requires additional implementation');
    return false;
  }

  /**
   * Engage with a cast (decide: like, recast, or reply). Returns the action type performed.
   */
  async engageWith(cast, personality, claudeClient = null) {
    const rand = Math.random();

    if (rand < 0.5) {
      const ok = await this.likeCast(cast.hash, cast.author.fid);
      return ok ? 'like' : null;
    }
    if (rand < 0.75) {
      const ok = await this.recast(cast.hash, cast.author.fid);
      return ok ? 'recast' : null;
    }
    if (claudeClient) {
      try {
        const replyText = await claudeClient.generateCast({
          personality,
          archetype: 'explorer',
          replyTo: cast,
        });
        const ok = await this.reply(cast.hash, cast.author.fid, replyText);
        return ok ? 'reply' : null;
      } catch (err) {
        console.error('Reply generation failed:', err.message);
        const ok = await this.likeCast(cast.hash, cast.author.fid);
        return ok ? 'like' : null;
      }
    }
    const ok = await this.likeCast(cast.hash, cast.author.fid);
    return ok ? 'like' : null;
  }
}

module.exports = EngagementSystem;
