// flightCard.js — Generates a single-flight detail card (FlightRadar24 style)
// Place this file in your ROOT folder, same level as index.js
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

try {
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'), 'Roboto');
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Roboto-Bold.ttf'), 'Roboto-Bold');
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

async function generateFlightCard(flight, host, flightType) {
  const WIDTH  = 1000;
  const HEIGHT = 420;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const HEADER_H = 100;
  ctx.fillStyle = VNA_NAVY;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);
  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, 0, 7, HEADER_H);

  const flightNumber = flight.flight_number || 'N/A';
  const prefix = flightNumber.slice(0, 2).toUpperCase();
  const airlineInfo = AIRLINE_BADGE[prefix] || AIRLINE_BADGE.VN;

  ctx.fillStyle = WHITE;
  ctx.font = '30px Roboto-Bold';
  ctx.fillText(airlineInfo.name, 36, 42);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px Roboto';
  ctx.fillText(`${flightType || 'Flight'}  ·  FLIGHT DETAILS`, 36, 64);

  ctx.fillStyle = WHITE;
  ctx.font = '34px Roboto-Bold';
  const fnW = ctx.measureText(flightNumber).width;
  ctx.fillText(flightNumber, WIDTH - 36 - fnW, 50);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px Roboto';
  const dateStr = formatDateICT(flight.timestamp);
  const dateW = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, WIDTH - 36 - dateW, 70);

  ctx.fillStyle = VNA_GOLD;
  ctx.fillRect(0, HEADER_H, WIDTH, 6);

  const routeY = HEADER_H + 6 + 70;

  ctx.fillStyle = TEXT_DARK;
  ctx.font = '46px Roboto-Bold';
  ctx.fillText((flight.origin || 'N/A').slice(0, 4).toUpperCase(), 60, routeY);

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '14px Roboto';
  ctx.fillText('FROM', 64, routeY + 22);
  ctx.fillText((flight.origin_name || flight.origin || 'N/A').slice(0, 28), 60, routeY + 42);

  const lineY = routeY - 14;
  const lineStartX = 280;
  const lineEndX = WIDTH - 280;
  ctx.strokeStyle = MID_GREY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lineStartX, lineY);
  ctx.lineTo(lineEndX, lineY);
  ctx.stroke();

  ctx.fillStyle = VNA_GOLD;
  ctx.beginPath();
  ctx.arc((lineStartX + lineEndX) / 2, lineY, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TEXT_DARK;
  ctx.font = '46px Roboto-Bold';
  const destCode = (flight.destination || 'N/A').slice(0, 4).toUpperCase();
  const destCodeW = ctx.measureText(destCode).width;
  ctx.fillText(destCode, WIDTH - 60 - destCodeW, routeY);

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '14px Roboto';
  const toLabelW = ctx.measureText('TO').width;
  ctx.fillText('TO', WIDTH - 64 - toLabelW, routeY + 22);
  const destName = (flight.destination_name || flight.destination || 'N/A').slice(0, 28);
  const destNameW = ctx.measureText(destName).width;
  ctx.fillText(destName, WIDTH - 60 - destNameW, routeY + 42);

  const gridY = routeY + 90;
  const gridH = 110;

  ctx.fillStyle = LIGHT_GREY;
  roundRect(ctx, 36, gridY, WIDTH - 72, gridH, 12);
  ctx.fill();

  const cells = [
    { label: 'AIRCRAFT', value: flight.aircraft || 'N/A' },
    { label: 'DEPARTURE', value: formatTimeICT(flight.timestamp) + ' ICT' },
    { label: 'GATE', value: flight.gate || 'TBA' },
    { label: 'HOST / PILOT', value: host || 'TBA' },
  ];

  const cellW = (WIDTH - 72) / cells.length;
  for (let i = 0; i < cells.length; i++) {
    const cx = 36 + i * cellW + 32;
    if (i > 0) {
      ctx.strokeStyle = MID_GREY;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36 + i * cellW, gridY + 20);
      ctx.lineTo(36 + i * cellW, gridY + gridH - 20);
      ctx.stroke();
    }
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font = '12px Roboto-Bold';
    ctx.fillText(cells[i].label, cx, gridY + 36);

    ctx.fillStyle = VNA_NAVY;
    ctx.font = '20px Roboto-Bold';
    const val = cells[i].value.length > 16 ? cells[i].value.slice(0, 15) + '…' : cells[i].value;
    ctx.fillText(val, cx, gridY + 70);
  }

  const footerY = gridY + gridH + 30;
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
