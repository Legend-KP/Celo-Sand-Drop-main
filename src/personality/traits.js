// Schwartz Value Theory implementation for Farcaster agents

const TRAIT_DEFINITIONS = {
  selfDirection: {
    name: 'Self-Direction',
    influences: ['contentCreativity', 'explorationBehavior', 'independence'],
  },
  stimulation: {
    name: 'Stimulation',
    influences: ['postingFrequency', 'topicVariety', 'riskTaking'],
  },
  hedonism: {
    name: 'Hedonism',
    influences: ['funContent', 'memeSharing', 'casualTone'],
  },
  achievement: {
    name: 'Achievement',
    influences: ['goalSetting', 'performanceTracking', 'competitiveness'],
  },
  power: {
    name: 'Power',
    influences: ['followStrategy', 'authorityTone', 'networkBuilding'],
  },
  security: {
    name: 'Security',
    influences: ['riskAvoidance', 'stableBehavior', 'communityLoyalty'],
  },
  conformity: {
    name: 'Conformity',
    influences: ['trendFollowing', 'politeness', 'rulesAdherence'],
  },
  tradition: {
    name: 'Tradition',
    influences: ['valueRespect', 'consistencyPreference', 'culturePreservation'],
  },
  benevolence: {
    name: 'Benevolence',
    influences: ['helpfulness', 'supportiveComments', 'communityFocus'],
  },
  universalism: {
    name: 'Universalism',
    influences: ['inclusivity', 'fairness', 'broadPerspective'],
  },
};

// Personality Archetypes (1–10 scale)
const ARCHETYPES = {
  explorer: {
    selfDirection: 9,
    stimulation: 8,
    universalism: 7,
    hedonism: 6,
    achievement: 5,
    benevolence: 6,
    power: 3,
    security: 3,
    conformity: 2,
    tradition: 2,
  },
  achiever: {
    achievement: 9,
    power: 7,
    stimulation: 6,
    selfDirection: 6,
    security: 5,
    hedonism: 4,
    conformity: 5,
    benevolence: 4,
    universalism: 4,
    tradition: 3,
  },
  guardian: {
    security: 9,
    tradition: 8,
    conformity: 8,
    benevolence: 7,
    universalism: 5,
    achievement: 4,
    selfDirection: 3,
    stimulation: 2,
    hedonism: 3,
    power: 4,
  },
  connector: {
    benevolence: 9,
    universalism: 8,
    hedonism: 6,
    selfDirection: 5,
    stimulation: 5,
    conformity: 5,
    achievement: 4,
    security: 6,
    tradition: 4,
    power: 2,
  },
  maverick: {
    selfDirection: 9,
    hedonism: 8,
    stimulation: 8,
    achievement: 6,
    universalism: 5,
    conformity: 1,
    tradition: 1,
    security: 3,
    benevolence: 5,
    power: 4,
  },
};

module.exports = { TRAIT_DEFINITIONS, ARCHETYPES };
