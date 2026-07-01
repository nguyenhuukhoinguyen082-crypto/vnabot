// flightCard.js — Full redesign: aircraft photo background + white overlay
// Place this file in your ROOT folder, same level as index.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

try {
  registerFont(path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'), { family: 'Roboto' });
  registerFont(path.join(__dirname, 'fonts', 'Roboto-Bold.ttf'), { family: 'Roboto-Bold' });
} catch (err) {
  console.error('Font registration in flightCard.js failed:', err.message);
}

const VNA_NAVY   = '#006785';
const VNA_GOLD   = '#DC9D1F';
const WHITE      = '#FFFFFF';
const LIGHT_GREY = '#F4F7FB';
const MID_GREY   = '#E2E8F0';
const TEXT_DARK  = '#0D1B2A';
const TEXT_LIGHT = '#718096';
const GREEN      = '#22C55E';

const LOGO_URL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

const AIRLINE_BADGE = {
  VN: { name: 'Vietnam Airlines' },
  BL: { name: 'Pacific Airlines' },
  OV: { name: 'VASCO' },
};

function formatTimeICT(timestamp) {
  if (!timestamp) return 'TBA';
  const ict = new Date(timestamp + 7 * 60 * 60 * 1000);
  const h = ict.getUTCHours().toString().padStart(2, '0');
  const m = ict.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateICT(timestamp) {
  if (!timestamp) return 'TBA';
  const ict = new Date(timestamp + 7 * 60 * 60 * 1000);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[ict.getUTCDay()]}, ${ict.getUTCDate()} ${months[ict.getUTCMonth()]} ${ict.getUTCFullYear()}`;
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

/**
 * Draws an image scaled to "cover" the target rect (like CSS background-size: cover)
 */
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let drawW, drawH, offsetX, offsetY;

  if (imgRatio > boxRatio) {
    drawH = h;
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
    offsetY = y;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    offsetX = x;
    offsetY = y - (drawH - h) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

async function generateFlightCard(flight, host, flightType) {
  const WIDTH  = 1000;
  const HEIGHT = 460;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  // ── Background: aircraft photo (if available) + white overlay ──────────────
  let hasPhoto = false;
  if (flight.aircraft_image) {
    try {
      const img = await loadImage(flight.aircraft_image);
      drawImageCover(ctx, img, 0, 0, WIDTH, HEIGHT);
      hasPhoto = true;
    } catch (err) {
      console.error('Aircraft image load failed:', err.message);
    }
  }

  if (!hasPhoto) {
    // Fallback: soft navy-to-white gradient background
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#E8F2F5');
    grad.addColorStop(1, WHITE);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // White semi-transparent overlay so all text stays readable
  // (does NOT fully hide the photo — background remains visible through it)
  ctx.fillStyle = 'rgba(255,255,255,0.80)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Navy header (solid, sits above the overlay) ─────────────────────────────
  const HEADER_H = 100;
  ctx.fillStyle = VNA_NAVY;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, 0, 7, HEADER_H);

  const flightNumber = flight.flight_number || 'N/A';
  const prefix = flightNumber.slice(0, 2).toUpperCase();
  const airlineInfo = AIRLINE_BADGE[prefix] || AIRLINE_BADGE.VN;

  // Logo (small circle) next to airline name
  try {
    const logoImg = await loadImage(LOGO_URL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(56, 50, 26, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(ctx, logoImg, 30, 24, 52, 52);
    ctx.restore();
  } catch (err) {
    // Logo load failed — skip silently, header text still renders fine
  }

  const textStartX = 98;

  ctx.fillStyle = WHITE;
  ctx.font = '28px Roboto-Bold';
  ctx.fillText(airlineInfo.name, textStartX, 42);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px Roboto';
  ctx.fillText(`${flightType || 'Flight'}  ·  FLIGHT DETAILS`, textStartX, 64);

  ctx.fillStyle = WHITE;
  ctx.font = '34px Roboto-Bold';
  const fnW = ctx.measureText(flightNumber).width;
  ctx.fillText(flightNumber, WIDTH - 36 - fnW, 50);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px Roboto';
  const dateStr = formatDateICT(flight.timestamp);
  const dateW = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, WIDTH - 36 - dateW, 70);

  // ── Gold stripe ────────────────────────────────────────────────────────────
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, HEADER_H, WIDTH, 6);

  // ── Route: BIG BOLD IATA codes, airport names below ─────────────────────────
  const routeY = HEADER_H + 6 + 78;

  const originIata = flight.origin_iata || (flight.origin || 'N/A').slice(0, 3).toUpperCase();
  const destIata    = flight.dest_iata || (flight.destination || 'N/A').slice(0, 3).toUpperCase();

  ctx.fillStyle = TEXT_DARK;
  ctx.font = '56px Roboto-Bold';
  ctx.fillText(originIata, 60, routeY);

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '14px Roboto';
  ctx.fillText('FROM', 64, routeY + 22);
  ctx.fillText((flight.origin_name || flight.origin || 'N/A').slice(0, 30), 60, routeY + 44);

  // Connector line + plane marker
  const lineY = routeY - 18;
  const lineStartX = 300;
  const lineEndX   = WIDTH - 300;
  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(lineStartX, lineY);
  ctx.lineTo(lineEndX, lineY);
  ctx.stroke();

  ctx.fillStyle = VNA_GOLD;
  ctx.beginPath();
  ctx.arc((lineStartX + lineEndX) / 2, lineY, 10, 0, Math.PI * 2);
  ctx.fill();

  // Destination (right aligned)
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '56px Roboto-Bold';
  const destW = ctx.measureText(destIata).width;
  ctx.fillText(destIata, WIDTH - 60 - destW, routeY);

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '14px Roboto';
  const toLabelW = ctx.measureText('TO').width;
  ctx.fillText('TO', WIDTH - 64 - toLabelW, routeY + 22);
  const destName = (flight.destination_name || flight.destination || 'N/A').slice(0, 30);
  const destNameW = ctx.measureText(destName).width;
  ctx.fillText(destName, WIDTH - 60 - destNameW, routeY + 44);

  // ── Info grid ──────────────────────────────────────────────────────────────
  const gridY = routeY + 74;
  const gridH = 106;

  ctx.fillStyle = 'rgba(244,247,251,0.92)';
  roundRect(ctx, 36, gridY, WIDTH - 72, gridH, 12);
  ctx.fill();
  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth = 1;
  roundRect(ctx, 36, gridY, WIDTH - 72, gridH, 12);
  ctx.stroke();

  const cells = [
    { label: 'AIRCRAFT',     value: flight.aircraft || 'N/A' },
    { label: 'DEPARTURE',    value: formatTimeICT(flight.timestamp) + ' ICT' },
    { label: 'GATE',         value: flight.gate || 'TBA' },
    { label: 'HOST / PILOT', value: host || 'TBA' },
  ];

  const cellW = (WIDTH - 72) / cells.length;
  for (let i = 0; i < cells.length; i++) {
    const cx = 36 + i * cellW + 32;
    if (i > 0) {
      ctx.strokeStyle = MID_GREY;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36 + i * cellW, gridY + 18);
      ctx.lineTo(36 + i * cellW, gridY + gridH - 18);
      ctx.stroke();
    }
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font = '12px Roboto-Bold';
    ctx.fillText(cells[i].label, cx, gridY + 34);

    ctx.fillStyle = VNA_NAVY;
    ctx.font = '20px Roboto-Bold';
    const val = cells[i].value.length > 16 ? cells[i].value.slice(0, 15) + '…' : cells[i].value;
    ctx.fillText(val, cx, gridY + 66);
  }

  // ── Booking prompt line ──────────────────────────────────────────────────────
  const bookingY = gridY + gridH + 26;
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '15px Roboto';
  ctx.fillText('To book your flight, please interact with the button below.', 36, bookingY);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = bookingY + 24;
  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, footerY - 14);
  ctx.lineTo(WIDTH - 36, footerY - 14);
  ctx.stroke();

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '13px Roboto';
  ctx.fillText('Vietnam Airlines Group | PTFS  ·  Sải Cánh Vươn Cao', 36, footerY);

  ctx.fillStyle = GREEN;
  ctx.font = '13px Roboto-Bold';
  const statusLabel = (flight.status || 'SCHEDULED').toUpperCase();
  const statusW = ctx.measureText(statusLabel).width;
  ctx.fillText(statusLabel, WIDTH - 36 - statusW, footerY);

  return canvas.toBuffer('image/png');
}

module.exports = { generateFlightCard };
