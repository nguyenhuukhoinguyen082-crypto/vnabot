// ─────────────────────────────────────────────────────────────────────────────
// Shared helper functions for LotusMiles + Career systems
// NOT a command — imported by other command files
// ─────────────────────────────────────────────────────────────────────────────

const { getFFConfig, getFrequentFlyer, updateFrequentFlyer, getCareerConfig, getCareer, updateCareer } = require('../firebase');

/**
 * Determine which FF tier a user qualifies for based on lifetime miles
 */
function calculateTier(lifetimeMiles, tiers) {
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
  for (const tier of sorted) {
    if (lifetimeMiles >= tier.threshold) return tier;
  }
  return sorted[sorted.length - 1];
}

/**
 * Award miles when a flight is booked, update tier, and sync Discord role
 */
async function awardMiles(guild, discordId, seatClass) {
  const config = await getFFConfig();
  const ff = await getFrequentFlyer(discordId);

  const base = config.miles_per_flight || 500;
  const bonus = seatClass === 'business' ? (config.miles_per_business_bonus || 250) : 0;
  const earned = base + bonus;

  const newMiles = (ff.miles || 0) + earned;
  const newLifetime = (ff.lifetime_miles || 0) + earned;
  const newFlights = (ff.flights_completed || 0) + 1;

  const oldTier = calculateTier(ff.lifetime_miles || 0, config.tiers);
  const newTier = calculateTier(newLifetime, config.tiers);

  await updateFrequentFlyer(discordId, {
    miles: newMiles,
    lifetime_miles: newLifetime,
    flights_completed: newFlights,
    tier: newTier.name,
  });

  // Sync role if tier changed
  let tierChanged = false;
  if (oldTier.name !== newTier.name) {
    tierChanged = true;
    try {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        // Remove old tier roles, add new one
        for (const tier of config.tiers) {
          if (tier.role_id && member.roles.cache.has(tier.role_id) && tier.role_id !== newTier.role_id) {
            await member.roles.remove(tier.role_id).catch(() => {});
          }
        }
        if (newTier.role_id) {
          await member.roles.add(newTier.role_id).catch(() => {});
        }
      }
    } catch (err) {
      console.error('FF role sync failed:', err.message);
    }
  }

  return { earned, newMiles, newLifetime, newTier, tierChanged, oldTier };
}

/**
 * Deduct miles when a booking is cancelled
 */
async function deductMiles(guild, discordId, seatClass) {
  const config = await getFFConfig();
  const ff = await getFrequentFlyer(discordId);

  const base = config.miles_per_flight || 500;
  const bonus = seatClass === 'business' ? (config.miles_per_business_bonus || 250) : 0;
  const deducted = base + bonus;

  const newMiles = Math.max(0, (ff.miles || 0) - deducted);
  const newLifetime = Math.max(0, (ff.lifetime_miles || 0) - deducted);
  const newFlights = Math.max(0, (ff.flights_completed || 0) - 1);

  const oldTier = calculateTier(ff.lifetime_miles || 0, config.tiers);
  const newTier = calculateTier(newLifetime, config.tiers);

  await updateFrequentFlyer(discordId, {
    miles: newMiles,
    lifetime_miles: newLifetime,
    flights_completed: newFlights,
    tier: newTier.name,
  });

  // Sync role if tier dropped
  let tierChanged = false;
  if (oldTier.name !== newTier.name) {
    tierChanged = true;
    try {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        for (const tier of config.tiers) {
          if (tier.role_id && member.roles.cache.has(tier.role_id) && tier.role_id !== newTier.role_id) {
            await member.roles.remove(tier.role_id).catch(() => {});
          }
        }
        if (newTier.role_id) {
          await member.roles.add(newTier.role_id).catch(() => {});
        }
      }
    } catch (err) {
      console.error('FF role sync (deduct) failed:', err.message);
    }
  }

  return { deducted, newMiles, newLifetime, newTier, tierChanged, oldTier };
}

/**
 * Determine which career rank a user qualifies for
 */
function calculateRank(daysInServer, flightsCompleted, ranks) {
  const sorted = [...ranks].sort((a, b) => b.flights_required - a.flights_required);
  for (const rank of sorted) {
    if (daysInServer >= rank.days_required && flightsCompleted >= rank.flights_required) {
      return rank;
    }
  }
  return sorted[sorted.length - 1];
}

/**
 * Update career progress (call this after a flight completes)
 */
async function updateCareerProgress(guild, discordId, joinedAtTimestamp, flightDelta = 1) {
  const config = await getCareerConfig();
  const career = await getCareer(discordId);

  const newFlights = Math.max(0, (career.flights_completed || 0) + flightDelta);
  const daysInServer = Math.floor((Date.now() - (career.join_timestamp || joinedAtTimestamp || Date.now())) / 86400000);

  const oldRank = calculateRank(
    Math.floor((Date.now() - (career.join_timestamp || joinedAtTimestamp || Date.now())) / 86400000),
    career.flights_completed || 0,
    config.ranks
  );
  const newRank = calculateRank(daysInServer, newFlights, config.ranks);

  await updateCareer(discordId, {
    flights_completed: newFlights,
    rank: newRank.name,
    join_timestamp: career.join_timestamp || joinedAtTimestamp || Date.now(),
  });

  let rankChanged = false;
  if (oldRank.name !== newRank.name) {
    rankChanged = true;
    try {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        for (const rank of config.ranks) {
          if (rank.role_id && member.roles.cache.has(rank.role_id) && rank.role_id !== newRank.role_id) {
            await member.roles.remove(rank.role_id).catch(() => {});
          }
        }
        if (newRank.role_id) {
          await member.roles.add(newRank.role_id).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Career role sync failed:', err.message);
    }
  }

  return { newFlights, daysInServer, newRank, rankChanged, oldRank };
}

module.exports = {
  calculateTier, awardMiles, deductMiles,
  calculateRank, updateCareerProgress,
};
