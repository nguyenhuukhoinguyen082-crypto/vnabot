// seatMapImage.js — Generates a visual seat map image using canvas
// Place this file in your ROOT folder, same level as index.js
const { createCanvas, registerFont } = require('canvas');
const path = require('path');

try {
  registerFont(path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'), { family: 'Roboto' });
  registerFont(path.join(__dirname, 'fonts', 'Roboto-Bold.ttf'), { family: 'Roboto-Bold' });
} catch (err) {
  console.warn('Font registration in seatMapImage.js failed:', err.message);
}

const VNA_NAVY    = '#006785';
const VNA_GOLD    = '#DC9D1F';
const WHITE       = '#FFFFFF';
const LIGHT_GREY  = '#F4F7FB';
const MID_GREY    = '#E2E8F0';
const TEXT_DARK   = '#0D1B2A';
const TEXT_LIGHT  = '#718096';

// Seat class colors
const BUSINESS_COLOR  = '#1E90FF'; // Blue
const PREMIUM_COLOR   = '#FF8C00'; // Orange
const ECONOMY_COLOR   = '#22C55E'; // Green
const TAKEN_COLOR     = '#94A3B8'; // Grey
const SELECTED_COLOR  = '#DC9D1F'; // Gold (matches VNA branding)
const AISLE_GAP       = 18;
const SEAT_SIZE       = 26;
const SEAT_GAP        = 6;
const ROW_HEIGHT       = 34;

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

/**
 * Determine the seat color based on its class and status.
 */
function getSeatColor(row, col, config, takenSet, selectedSeat) {
  const seatId = `${row}${col}`.toUpperCase();

  if (seatId === (selectedSeat || '').toUpperCase()) return SELECTED_COLOR;
  if (takenSet.has(seatId)) return TAKEN_COLOR;

  if (config.businessRows?.includes(row)) return BUSINESS_COLOR;
  if (config.premiumRows?.includes(row)) return PREMIUM_COLOR;
  return ECONOMY_COLOR;
}

/**
 * Generate a seat map image for a given aircraft config and page of rows.
 * @param {object} config - aircraft seat config (from seatmap.js)
 * @param {string[]} takenSeats - array of taken seat IDs e.g. ["1A", "3C"]
 * @param {string|null} selectedSeat - currently selected seat ID, if any
 * @param {number} page - current page (0-indexed)
 * @param {number} rowsPerPage - rows per page (default 10)
 * @param {string} flightNumber - for the header
 */
async function generateSeatMapImage(config, takenSeats, selectedSeat, page, rowsPerPage, flightNumber) {
  const cols = config.cols || ['A', 'B', 'C', 'D', 'E', 'F'];
  const takenSet = new Set((takenSeats || []).map(s => s.toUpperCase()));

  const startRow = page * rowsPerPage + 1;
  const endRow   = Math.min((page + 1) * rowsPerPage, config.totalRows);
  const rowsToShow = [];
  for (let r = startRow; r <= endRow; r++) rowsToShow.push(r);

  // Determine aisle position (split columns in half, e.g. ABC | DEF)
  const mid = Math.ceil(cols.length / 2);
  const leftCols = cols.slice(0, mid);
  const rightCols = cols.slice(mid);

  const WIDTH = 60 + leftCols.length * (SEAT_SIZE + SEAT_GAP) + AISLE_GAP + rightCols.length * (SEAT_SIZE + SEAT_GAP) + 220;
  const HEADER_H = 70;
  const COL_LABEL_H = 30;
  const HEIGHT = HEADER_H + COL_LABEL_H + rowsToShow.length * ROW_HEIGHT + 90;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Header
  ctx.fillStyle = VNA_NAVY;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, 0, 6, HEADER_H);

  ctx.fillStyle = WHITE;
  ctx.font = '22px Roboto-Bold';
  ctx.fillText(`Seat Map — ${flightNumber || 'Flight'}`, 24, 32);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px Roboto';
  ctx.fillText(`${config.name || 'Aircraft'}  ·  Rows ${startRow}–${endRow} of ${config.totalRows}`, 24, 52);

  // Column letter labels
  const seatStartX = 60;
  let x = seatStartX;
  ctx.font = '14px Roboto-Bold';
  ctx.fillStyle = TEXT_DARK;
  ctx.textAlign = 'center';

  for (const col of leftCols) {
    ctx.fillText(col, x + SEAT_SIZE / 2, HEADER_H + 22);
    x += SEAT_SIZE + SEAT_GAP;
  }
  x += AISLE_GAP;
  for (const col of rightCols) {
    ctx.fillText(col, x + SEAT_SIZE / 2, HEADER_H + 22);
    x += SEAT_SIZE + SEAT_GAP;
  }
  ctx.textAlign = 'left';

  // Seat rows
  let y = HEADER_H + COL_LABEL_H;
  for (const row of rowsToShow) {
    // Row number
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font = '13px Roboto-Bold';
    ctx.textAlign = 'right';
    ctx.fillText(String(row), seatStartX - 12, y + SEAT_SIZE / 2 + 5);
    ctx.textAlign = 'left';

    const isBiz = config.businessRows?.includes(row);
    const isPrem = config.premiumRows?.includes(row);
    const rowCols = isBiz ? (config.businessCols || cols) : isPrem ? (config.premiumCols || cols) : (config.economyCols || cols);

    let sx = seatStartX;
    for (const col of leftCols) {
      if (rowCols.includes(col)) {
        const color = getSeatColor(row, col, config, takenSet, selectedSeat);
        ctx.fillStyle = color;
        roundRect(ctx, sx, y, SEAT_SIZE, SEAT_SIZE, 5);
        ctx.fill();
      }
      sx += SEAT_SIZE + SEAT_GAP;
    }
    sx += AISLE_GAP;
    for (const col of rightCols) {
      if (rowCols.includes(col)) {
        const color = getSeatColor(row, col, config, takenSet, selectedSeat);
        ctx.fillStyle = color;
        roundRect(ctx, sx, y, SEAT_SIZE, SEAT_SIZE, 5);
        ctx.fill();
      }
      sx += SEAT_SIZE + SEAT_GAP;
    }

    // Exit row marker
    if (config.exitRows?.includes(row)) {
      ctx.fillStyle = TEXT_LIGHT;
      ctx.font = '11px Roboto';
      ctx.fillText('EXIT', sx + AISLE_GAP, y + SEAT_SIZE / 2 + 4);
    }

    y += ROW_HEIGHT;
  }

  // Legend
  const legendY = y + 20;
  const legendItems = [
    { color: BUSINESS_COLOR, label: 'Business' },
    { color: PREMIUM_COLOR, label: 'Premium Economy' },
    { color: ECONOMY_COLOR, label: 'Economy' },
    { color: TAKEN_COLOR, label: 'Taken' },
    { color: SELECTED_COLOR, label: 'Selected' },
  ];

  let lx = seatStartX;
  ctx.font = '12px Roboto';
  for (const item of legendItems) {
    ctx.fillStyle = item.color;
    roundRect(ctx, lx, legendY, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = TEXT_DARK;
    ctx.fillText(item.label, lx + 22, legendY + 13);
    lx += 22 + ctx.measureText(item.label).width + 24;
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateSeatMapImage };
