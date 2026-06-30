// flightBoard.js — Generates a VNA-styled flight board image using canvas
const { createCanvas } = require('canvas');
const { FONT_FAMILY_REGULAR, FONT_FAMILY_BOLD } = require('./canvasFonts');

// VNA Brand Colors
const VNA_NAVY   = '#006785';
const VNA_GOLD   = '#DC9D1F';
const WHITE      = '#FFFFFF';
const LIGHT_GREY = '#F4F7FB';
const MID_GREY   = '#E2E8F0';
const TEXT_DARK  = '#0D1B2A';
const TEXT_MID   = '#4A5568';
const TEXT_LIGHT = '#718096';
const GREEN      = '#22C55E';
const AMBER      = '#F59E0B';
const RED        = '#EF4444';
const BLUE       = '#3B82F6';

const font = (size, family) => `${size}px ${family}`;

const STATUS_COLORS = {
  scheduled: { bg: '#EFF6FF', text: BLUE,  label: 'SCHEDULED'  },
  boarding:  { bg: '#ECFDF5', text: GREEN,  label: 'BOARDING'   },
  departed:  { bg: '#F0FDF4', text: GREEN,  label: 'DEPARTED'   },
  delayed:   { bg: '#FFFBEB', text: AMBER,  label: 'DELAYED'    },
  cancelled: { bg: '#FEF2F2', text: RED,    label: 'CANCELLED'  },
  ended:     { bg: '#F9FAFB', text: '#9CA3AF', label: 'ENDED'   },
};

function formatTime(timestamp) {
  if (!timestamp) return 'TBA';
  const d = new Date(timestamp);
  // Convert UTC to ICT (UTC+7)
  const ict = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const h = ict.getUTCHours().toString().padStart(2, '0');
  const m = ict.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m} ICT`;
}

function truncate(str, max) {
  if (!str) return 'N/A';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateFlightBoard(flights, bookingsMap, guildName) {
  const ROW_H      = 64;
  const HEADER_H   = 110;
  const GOLD_H     = 6;
  const COL_H      = 44;
  const FOOTER_H   = 36;
  const PAD        = 28;
  const MIN_ROWS   = 1;

  const visibleFlights = flights.slice(0, 12); // max 12 rows
  const rows = Math.max(MIN_ROWS, visibleFlights.length);
  const HEIGHT = HEADER_H + GOLD_H + COL_H + rows * ROW_H + FOOTER_H + 16;
  const WIDTH  = 1100;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Navy header bar ────────────────────────────────────────────────────────
  ctx.fillStyle = VNA_NAVY;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);

  // Left accent stripe
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, 0, 7, HEADER_H);

  // Logo / Airline name
  ctx.fillStyle = WHITE;
  ctx.font      = font(32, FONT_FAMILY_BOLD);
  ctx.fillText('Vietnam Airlines', PAD + 8, 44);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font      = font(15, FONT_FAMILY_REGULAR);
  ctx.fillText(`${guildName}  ·  LIVE FLIGHT BOARD`, PAD + 8, 68);

  // DEPARTURES label (top right)
  ctx.fillStyle = WHITE;
  ctx.font      = font(28, FONT_FAMILY_BOLD);
  const depLabel = 'DEPARTURES';
  const depW     = ctx.measureText(depLabel).width;
  ctx.fillText(depLabel, WIDTH - PAD - depW, 44);

  // Date/time (top right, below DEPARTURES)
  const now     = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dateStr = now.toUTCString().replace(' GMT', ' ICT').slice(0, 25);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font      = font(13, FONT_FAMILY_REGULAR);
  const dtW     = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, WIDTH - PAD - dtW, 68);

  // ── Gold stripe ────────────────────────────────────────────────────────────
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, HEADER_H, WIDTH, GOLD_H);

  // ── Column headers ─────────────────────────────────────────────────────────
  const colY   = HEADER_H + GOLD_H;
  ctx.fillStyle = LIGHT_GREY;
  ctx.fillRect(0, colY, WIDTH, COL_H);

  const COLS = [
    { label: 'FLIGHT',   x: PAD,       w: 110 },
    { label: 'ROUTE',    x: 155,       w: 220 },
    { label: 'AIRCRAFT', x: 390,       w: 190 },
    { label: 'DEP',      x: 595,       w: 110 },
    { label: 'GATE',     x: 720,       w: 70  },
    { label: 'CREW',     x: 805,       w: 80  },
    { label: 'STATUS',   x: 900,       w: 172 },
  ];

  ctx.fillStyle = VNA_NAVY;
  ctx.font      = font(13, FONT_FAMILY_BOLD);
  for (const col of COLS) {
    ctx.fillText(col.label, col.x, colY + 28);
  }

  // Divider line under headers
  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, colY + COL_H - 1);
  ctx.lineTo(WIDTH - PAD, colY + COL_H - 1);
  ctx.stroke();

  // ── Flight rows ────────────────────────────────────────────────────────────
  const rowsStartY = colY + COL_H;

  if (visibleFlights.length === 0) {
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font      = font(18, FONT_FAMILY_REGULAR);
    ctx.fillText('No flights scheduled in the next 24 hours.', PAD, rowsStartY + 38);
  }

  for (let i = 0; i < visibleFlights.length; i++) {
    const f      = visibleFlights[i];
    const rowY   = rowsStartY + i * ROW_H;
    const isEven = i % 2 === 0;

    // Row background
    ctx.fillStyle = isEven ? WHITE : LIGHT_GREY;
    ctx.fillRect(0, rowY, WIDTH, ROW_H);

    // Left accent for first row
    if (i === 0) {
      ctx.fillStyle = VNA_GOLD;
      ctx.fillRect(0, rowY, 5, ROW_H);
    }

    const midY = rowY + ROW_H / 2 + 6;

    // Flight number
    ctx.fillStyle = VNA_NAVY;
    ctx.font      = font(20, FONT_FAMILY_BOLD);
    ctx.fillText(f.flight_number || 'N/A', COLS[0].x, midY);

    // Route
    const origin = truncate(f.origin || 'N/A', 14);
    const dest   = truncate(f.destination || 'N/A', 14);
    ctx.fillStyle = VNA_NAVY;
    ctx.font      = font(15, FONT_FAMILY_BOLD);
    ctx.fillText(`${origin} → ${dest}`, COLS[1].x, midY);

    // Aircraft
    ctx.fillStyle = TEXT_MID;
    ctx.font      = font(14, FONT_FAMILY_REGULAR);
    ctx.fillText(truncate(f.aircraft || 'N/A', 22), COLS[2].x, midY);

    // Departure time
    ctx.fillStyle = TEXT_DARK;
    ctx.font      = font(14, FONT_FAMILY_BOLD);
    ctx.fillText(formatTime(f.timestamp), COLS[3].x, midY);

    // Gate
    ctx.fillStyle = TEXT_MID;
    ctx.font      = font(14, FONT_FAMILY_REGULAR);
    ctx.fillText(f.gate || 'TBA', COLS[4].x, midY);

    // Crew booked / capacity
    const booked   = bookingsMap[f.id] || 0;
    const capacity = f.passenger_capacity || '?';
    ctx.fillStyle  = booked > 0 ? VNA_NAVY : TEXT_LIGHT;
    ctx.font       = font(14, FONT_FAMILY_BOLD);
    ctx.fillText(`${booked}/${capacity}`, COLS[5].x, midY);

    // Status badge
    const statusKey = (f.status || 'scheduled').toLowerCase();
    const status    = STATUS_COLORS[statusKey] || STATUS_COLORS.scheduled;
    const badgeX    = COLS[6].x;
    const badgeW    = 130;
    const badgeH    = 28;
    const badgeY    = rowY + (ROW_H - badgeH) / 2;

    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fillStyle = status.bg;
    ctx.fill();
    ctx.strokeStyle = status.text + '44';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.fillStyle = status.text;
    ctx.font      = font(12, FONT_FAMILY_BOLD);
    const labelW  = ctx.measureText(status.label).width;
    ctx.fillText(status.label, badgeX + (badgeW - labelW) / 2, badgeY + 18);

    // Row separator
    ctx.strokeStyle = MID_GREY;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, rowY + ROW_H - 1);
    ctx.lineTo(WIDTH - PAD, rowY + ROW_H - 1);
    ctx.stroke();
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = rowsStartY + rows * ROW_H;
  ctx.fillStyle  = LIGHT_GREY;
  ctx.fillRect(0, footerY, WIDTH, FOOTER_H + 16);

  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(WIDTH, footerY);
  ctx.stroke();

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font      = font(12, FONT_FAMILY_REGULAR);
  ctx.fillText(`AUTO-REFRESHES DAILY  ·  ${guildName}  ·  Flight Operations`, PAD, footerY + 22);

  const countLabel = `${visibleFlights.length} active flight${visibleFlights.length !== 1 ? 's' : ''}`;
  const countW     = ctx.measureText(countLabel).width;
  ctx.fillText(countLabel, WIDTH - PAD - countW, footerY + 22);

  return canvas.toBuffer('image/png');
}

module.exports = { generateFlightBoard };
