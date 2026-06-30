const { initializeApp } = require('firebase/app');
const {
  getDatabase, ref, get, set, push, update, remove,
} = require('firebase/database');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── FLIGHTS ──────────────────────────────────────────────────────────────────
async function getFlights() {
  const snap = await get(ref(db, 'flights'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getFlight(flightNumber) {
  const flights = await getFlights();
  return flights.find(f => f.flight_number?.toUpperCase() === flightNumber.toUpperCase()) || null;
}
async function createFlight(flightData) {
  const newRef = push(ref(db, 'flights'));
  await set(newRef, { ...flightData, created_at: Date.now(), status: 'scheduled', bookings_open: true });
  return newRef.key;
}
async function updateFlight(flightId, updates) {
  await update(ref(db, `flights/${flightId}`), updates);
}
async function deleteFlight(flightId) {
  await remove(ref(db, `flights/${flightId}`));
}

// ─── FLEET ────────────────────────────────────────────────────────────────────
async function getFleet() {
  const snap = await get(ref(db, 'fleet'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getPlane(planeId) {
  const snap = await get(ref(db, `fleet/${planeId}`));
  if (!snap.exists()) return null;
  return { id: planeId, ...snap.val() };
}
async function addPlane(planeData) {
  const newRef = push(ref(db, 'fleet'));
  await set(newRef, { ...planeData, created_at: Date.now() });
  return newRef.key;
}
async function updatePlane(planeId, updates) {
  await update(ref(db, `fleet/${planeId}`), updates);
}
async function deletePlane(planeId) {
  await remove(ref(db, `fleet/${planeId}`));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
async function getRoutes() {
  const snap = await get(ref(db, 'routes'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getRoute(routeId) {
  const snap = await get(ref(db, `routes/${routeId}`));
  if (!snap.exists()) return null;
  return { id: routeId, ...snap.val() };
}
async function addRoute(routeData) {
  const newRef = push(ref(db, 'routes'));
  await set(newRef, { ...routeData, created_at: Date.now(), status: 'Active' });
  return newRef.key;
}
async function deleteRoute(routeId) {
  await remove(ref(db, `routes/${routeId}`));
}

// ─── DESTINATIONS ─────────────────────────────────────────────────────────────
async function getDestinations() {
  const snap = await get(ref(db, 'destinations'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getDestination(name) {
  const dests = await getDestinations();
  return dests.find(d =>
    (d.name || '').toLowerCase() === name.toLowerCase() ||
    (d.code || '').toLowerCase() === name.toLowerCase()
  ) || null;
}
async function addDestination(destData) {
  const newRef = push(ref(db, 'destinations'));
  await set(newRef, { ...destData, created_at: Date.now() });
  return newRef.key;
}
async function removeDestination(destId) {
  await remove(ref(db, `destinations/${destId}`));
}

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────
async function getBookings(flightId = null) {
  const snap = await get(ref(db, 'bookings'));
  if (!snap.exists()) return [];
  const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
  if (flightId) return all.filter(b => b.flight_id === flightId);
  return all;
}
async function getUserBooking(discordId, flightId) {
  const bookings = await getBookings(flightId);
  return bookings.find(b => b.discord_id === discordId) || null;
}
async function createBooking(bookingData) {
  const newRef = push(ref(db, 'bookings'));
  const code = 'VN' + Math.random().toString(36).toUpperCase().slice(2, 8);
  await set(newRef, { ...bookingData, booking_code: code, created_at: Date.now(), status: 'confirmed' });
  return { id: newRef.key, code };
}
async function getBookingById(bookingId) {
  const snap = await get(ref(db, `bookings/${bookingId}`));
  if (!snap.exists()) return null;
  return { id: bookingId, ...snap.val() };
}
async function cancelBooking(bookingId) {
  await remove(ref(db, `bookings/${bookingId}`));
}
async function deleteFlightBookings(flightId) {
  const bookings = await getBookings(flightId);
  for (const b of bookings) await remove(ref(db, `bookings/${b.id}`));
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
async function getEvents() {
  const snap = await get(ref(db, 'events'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getEvent(eventId) {
  const snap = await get(ref(db, `events/${eventId}`));
  if (!snap.exists()) return null;
  return { id: eventId, ...snap.val() };
}
async function createEvent(eventData) {
  const newRef = push(ref(db, 'events'));
  await set(newRef, { ...eventData, created_at: Date.now(), rsvps: [] });
  return newRef.key;
}
async function updateEvent(eventId, updates) {
  await update(ref(db, `events/${eventId}`), updates);
}
async function deleteEvent(eventId) {
  await remove(ref(db, `events/${eventId}`));
}
async function rsvpEvent(eventId, discordId, username) {
  const event = await getEvent(eventId);
  if (!event) return false;
  const rsvps = event.rsvps || [];
  if (rsvps.find(r => r.discord_id === discordId)) return 'already';
  rsvps.push({ discord_id: discordId, username, joined_at: Date.now() });
  await update(ref(db, `events/${eventId}`), { rsvps });
  return true;
}

// ─── DEALS ────────────────────────────────────────────────────────────────────
async function getDeals() {
  const snap = await get(ref(db, 'deals'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getDeal(dealId) {
  const snap = await get(ref(db, `deals/${dealId}`));
  if (!snap.exists()) return null;
  return { id: dealId, ...snap.val() };
}
async function createDeal(dealData) {
  const newRef = push(ref(db, 'deals'));
  await set(newRef, { ...dealData, created_at: Date.now(), status: 'active' });
  return newRef.key;
}
async function endDeal(dealId) {
  await update(ref(db, `deals/${dealId}`), { status: 'ended', ended_at: Date.now() });
}
async function deleteDeal(dealId) {
  await remove(ref(db, `deals/${dealId}`));
}

// ─── MENU ─────────────────────────────────────────────────────────────────────
async function getMenu() {
  const snap = await get(ref(db, 'menu'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function createFoodOrder(orderData) {
  const newRef = push(ref(db, 'food_orders'));
  const code = 'VN' + Math.random().toString(36).toUpperCase().slice(2, 6);
  await set(newRef, { ...orderData, order_code: code, created_at: Date.now(), status: 'pending' });
  return { id: newRef.key, code };
}

// ─── ECONOMY ──────────────────────────────────────────────────────────────────
async function getEconomy(discordId) {
  const snap = await get(ref(db, `economy/${discordId}`));
  if (!snap.exists()) return { wallet: 0, bank: 0, xp: 0, level: 1, last_daily: 0, last_work: 0, last_crime: 0, last_mine: 0, last_fish: 0, last_beg: 0, last_rob: 0, inventory: [] };
  return snap.val();
}
async function updateEconomy(discordId, updates) {
  const current = await getEconomy(discordId);
  await set(ref(db, `economy/${discordId}`), { ...current, ...updates });
}
async function getEconomyLeaderboard() {
  const snap = await get(ref(db, 'economy'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, val]) => ({ discord_id: id, total: (val.wallet || 0) + (val.bank || 0), ...val }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

// ─── SHOP ─────────────────────────────────────────────────────────────────────
async function getShop() {
  const snap = await get(ref(db, 'shop'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function addShopItem(itemData) {
  const newRef = push(ref(db, 'shop'));
  await set(newRef, { ...itemData, created_at: Date.now() });
  return newRef.key;
}
async function getShopItem(itemId) {
  const snap = await get(ref(db, `shop/${itemId}`));
  if (!snap.exists()) return null;
  return { id: itemId, ...snap.val() };
}

// ─── ECONOMY CONFIG ───────────────────────────────────────────────────────────
async function getEconomyConfig() {
  const snap = await get(ref(db, 'economy_config'));
  if (!snap.exists()) return {
    daily_min: 500, daily_max: 2000,
    work_min: 200, work_max: 800,
    mine_min: 150, mine_max: 600,
    fish_min: 100, fish_max: 500,
    beg_min: 50, beg_max: 200,
    crime_min: 300, crime_max: 1200, crime_success_rate: 60, crime_fine: 300,
    rob_success_rate: 40, rob_fine: 500,
    gamble_min_bet: 100,
    cooldown_work: 3600, cooldown_mine: 3600, cooldown_fish: 1800,
    cooldown_beg: 900, cooldown_crime: 7200, cooldown_rob: 3600,
  };
  return snap.val();
}
async function updateEconomyConfig(updates) {
  const current = await getEconomyConfig();
  await set(ref(db, 'economy_config'), { ...current, ...updates });
}

// ─── PARTNERSHIPS ─────────────────────────────────────────────────────────────
async function getPartnerships() {
  const snap = await get(ref(db, 'partnerships'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getPartnership(name) {
  const partnerships = await getPartnerships();
  return partnerships.find(p => (p.name || '').toLowerCase() === name.toLowerCase()) || null;
}
async function addPartnership(data) {
  const newRef = push(ref(db, 'partnerships'));
  await set(newRef, { ...data, created_at: Date.now(), status: 'active' });
  return newRef.key;
}
async function removePartnership(id) {
  await remove(ref(db, `partnerships/${id}`));
}

// ─── FREQUENT FLYER (MILES) ───────────────────────────────────────────────────
async function getFrequentFlyer(discordId) {
  const snap = await get(ref(db, `lotus_miles/${discordId}`));
  if (!snap.exists()) return { miles: 0, lifetime_miles: 0, flights_completed: 0, tier: 'Member' };
  return snap.val();
}
async function updateFrequentFlyer(discordId, updates) {
  const current = await getFrequentFlyer(discordId);
  await set(ref(db, `lotus_miles/${discordId}`), { ...current, ...updates });
}
async function getFFConfig() {
  const snap = await get(ref(db, 'ff_config'));
  if (!snap.exists()) return {
    miles_per_flight: 500,
    miles_per_business_bonus: 250,
    tiers: [
      { name: 'Member', threshold: 0, role_id: null },
      { name: 'Silver', threshold: 5000, role_id: null },
      { name: 'Gold', threshold: 15000, role_id: null },
      { name: 'Platinum', threshold: 30000, role_id: null },
    ],
  };
  return snap.val();
}
async function updateFFConfig(updates) {
  const current = await getFFConfig();
  await set(ref(db, 'ff_config'), { ...current, ...updates });
}
async function getFFLeaderboard() {
  const snap = await get(ref(db, 'lotus_miles'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, val]) => ({ discord_id: id, ...val }))
    .sort((a, b) => (b.lifetime_miles || 0) - (a.lifetime_miles || 0))
    .slice(0, 10);
}

// ─── CAREER (TIME-IN-SERVER / FLIGHT RANK) ────────────────────────────────────
async function getCareer(discordId) {
  const snap = await get(ref(db, `career/${discordId}`));
  if (!snap.exists()) return { flights_completed: 0, rank: 'Trainee', join_timestamp: Date.now() };
  return snap.val();
}
async function updateCareer(discordId, updates) {
  const current = await getCareer(discordId);
  await set(ref(db, `career/${discordId}`), { ...current, ...updates });
}
async function getCareerConfig() {
  const snap = await get(ref(db, 'career_config'));
  if (!snap.exists()) return {
    ranks: [
      { name: 'Trainee', days_required: 0, flights_required: 0, role_id: null },
      { name: 'First Officer', days_required: 7, flights_required: 5, role_id: null },
      { name: 'Captain', days_required: 30, flights_required: 20, role_id: null },
      { name: 'Senior Captain', days_required: 90, flights_required: 50, role_id: null },
    ],
  };
  return snap.val();
}
async function updateCareerConfig(updates) {
  const current = await getCareerConfig();
  await set(ref(db, 'career_config'), { ...current, ...updates });
}
async function getCareerLeaderboard() {
  const snap = await get(ref(db, 'career'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, val]) => ({ discord_id: id, ...val }))
    .sort((a, b) => (b.flights_completed || 0) - (a.flights_completed || 0))
    .slice(0, 10);
}

// ─── TRAINING SESSIONS ────────────────────────────────────────────────────────
async function getTrainings() {
  const snap = await get(ref(db, 'trainings'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getTraining(id) {
  const snap = await get(ref(db, `trainings/${id}`));
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}
async function createTraining(data) {
  const newRef = push(ref(db, 'trainings'));
  await set(newRef, { ...data, created_at: Date.now(), status: 'scheduled', attendees: [] });
  return newRef.key;
}
async function deleteTraining(id) {
  await remove(ref(db, `trainings/${id}`));
}
async function updateTraining(id, updates) {
  await update(ref(db, `trainings/${id}`), updates);
}

// ─── CERTIFICATIONS ───────────────────────────────────────────────────────────
async function getCertifications(discordId = null) {
  const snap = await get(ref(db, 'certifications'));
  if (!snap.exists()) return [];
  const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
  if (discordId) return all.filter(c => c.discord_id === discordId);
  return all;
}
async function issueCertification(data) {
  const newRef = push(ref(db, 'certifications'));
  const certId = 'VJC-' + Math.random().toString(36).toUpperCase().slice(2, 8);
  await set(newRef, { ...data, cert_id: certId, issued_at: Date.now() });
  return { id: newRef.key, certId };
}
async function revokeCertification(id) {
  await remove(ref(db, `certifications/${id}`));
}
async function getCertConfig() {
  const snap = await get(ref(db, 'cert_config'));
  if (!snap.exists()) return { types: [
    { name: 'Pilot Certification', role_id: null },
    { name: 'ATC Certification', role_id: null },
    { name: 'Cabin Crew Certification', role_id: null },
    { name: 'Ground Crew Certification', role_id: null },
  ] };
  return snap.val();
}
async function updateCertConfig(updates) {
  const current = await getCertConfig();
  await set(ref(db, 'cert_config'), { ...current, ...updates });
}

// ─── BIRTHDAYS ────────────────────────────────────────────────────────────────
async function getBirthdays() {
  const snap = await get(ref(db, 'birthdays'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([discord_id, val]) => ({ discord_id, ...val }));
}
async function getBirthday(discordId) {
  const snap = await get(ref(db, `birthdays/${discordId}`));
  if (!snap.exists()) return null;
  return { discord_id: discordId, ...snap.val() };
}
async function setBirthday(discordId, day, month, username) {
  await set(ref(db, `birthdays/${discordId}`), { day, month, username, set_at: Date.now() });
}
async function removeBirthday(discordId) {
  await remove(ref(db, `birthdays/${discordId}`));
}
async function getBirthdayConfig() {
  const snap = await get(ref(db, 'birthday_config'));
  if (!snap.exists()) return { channel_id: null, last_announced: {} };
  return snap.val();
}
async function updateBirthdayConfig(updates) {
  const current = await getBirthdayConfig();
  await set(ref(db, 'birthday_config'), { ...current, ...updates });
}

async function getConfig() {
  const snap = await get(ref(db, 'config'));
  if (!snap.exists()) return { flightboard_channel_id: null };
  return snap.val();
}
async function updateConfig(updates) {
  const current = await getConfig();
  await set(ref(db, 'config'), { ...current, ...updates });
}

// ─── WELCOME SYSTEM ───────────────────────────────────────────────────────────
async function getWelcomeConfig() {
  const snap = await get(ref(db, 'welcome_config'));
  if (!snap.exists()) return {
    channel_id: null,
    role_id: null,
    rules_url: null,
    handbook_url: null,
    dm_enabled: true,
  };
  return snap.val();
}
async function updateWelcomeConfig(updates) {
  const current = await getWelcomeConfig();
  await set(ref(db, 'welcome_config'), { ...current, ...updates });
}


// ─── APPLICATION SYSTEM ───────────────────────────────────────────────────────
async function getApplicationTypes() {
  const snap = await get(ref(db, 'application_types'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}
async function getApplicationType(id) {
  const snap = await get(ref(db, `application_types/${id}`));
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}
async function getApplicationTypeByTitle(title) {
  const types = await getApplicationTypes();
  return types.find(t => t.title.toLowerCase() === title.toLowerCase()) || null;
}
async function addApplicationType(data) {
  const newRef = push(ref(db, 'application_types'));
  await set(newRef, { ...data, created_at: Date.now(), status: 'active' });
  return newRef.key;
}
async function removeApplicationType(id) {
  await remove(ref(db, `application_types/${id}`));
}
async function updateApplicationType(id, updates) {
  await update(ref(db, `application_types/${id}`), updates);
}
async function getApplications(filters = {}) {
  const snap = await get(ref(db, 'applications'));
  if (!snap.exists()) return [];
  let all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
  if (filters.discord_id) all = all.filter(a => a.discord_id === filters.discord_id);
  if (filters.type_id) all = all.filter(a => a.type_id === filters.type_id);
  if (filters.status) all = all.filter(a => a.status === filters.status);
  return all;
}
async function getApplication(id) {
  const snap = await get(ref(db, `applications/${id}`));
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}
async function createApplication(data) {
  const newRef = push(ref(db, 'applications'));
  await set(newRef, { ...data, created_at: Date.now(), status: 'pending' });
  return newRef.key;
}
async function updateApplication(id, updates) {
  await update(ref(db, `applications/${id}`), updates);
}
async function getApplicationConfig() {
  const snap = await get(ref(db, 'application_config'));
  if (!snap.exists()) return { review_channel_id: null };
  return snap.val();
}
async function updateApplicationConfig(updates) {
  const current = await getApplicationConfig();
  await set(ref(db, 'application_config'), { ...current, ...updates });
}

module.exports = {
  db,
  getFlights, getFlight, createFlight, updateFlight, deleteFlight,
  getFleet, getPlane, addPlane, updatePlane, deletePlane,
  getRoutes, getRoute, addRoute, deleteRoute,
  getDestinations, getDestination, addDestination, removeDestination,
  getBookings, getUserBooking, createBooking, getBookingById, cancelBooking, deleteFlightBookings,
  getEvents, getEvent, createEvent, updateEvent, deleteEvent, rsvpEvent,
  getDeals, getDeal, createDeal, endDeal, deleteDeal,
  getMenu, createFoodOrder,
  getEconomy, updateEconomy, getEconomyLeaderboard,
  getShop, addShopItem, getShopItem,
  getEconomyConfig, updateEconomyConfig,
  getPartnerships, getPartnership, addPartnership, removePartnership,
  getFrequentFlyer, updateFrequentFlyer, getFFConfig, updateFFConfig, getFFLeaderboard,
  getCareer, updateCareer, getCareerConfig, updateCareerConfig, getCareerLeaderboard,
  getTrainings, getTraining, createTraining, deleteTraining, updateTraining,
  getCertifications, issueCertification, revokeCertification, getCertConfig, updateCertConfig,
  getBirthdays, getBirthday, setBirthday, removeBirthday, getBirthdayConfig, updateBirthdayConfig,
  getConfig, updateConfig,
  getWelcomeConfig, updateWelcomeConfig,
  getApplicationTypes, getApplicationType, getApplicationTypeByTitle,
  addApplicationType, removeApplicationType, updateApplicationType,
  getApplications, getApplication, createApplication, updateApplication,
  getApplicationConfig, updateApplicationConfig,
};
