const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

const FOOTER = 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao';

const COLORS = {
  primary: 0x007B8A,
  success: 0x00B050,
  danger: 0xFF0000,
  warning: 0xC4972A,
  neutral: 0x888888,
  boost: 0xFF73FA,
};

const STATUS_EMOJI = {
  scheduled: '🕐',
  boarding: '🚪',
  departed: '✈️',
  arrived: '🛬',
  cancelled: '❌',
  delayed: '⏳',
};

const AIRLINE_PREFIX = {
  VN: { emoji: '<:hvntail:1514151733901787197>', name: 'Vietnam Airlines', key: 'vna' },
  BL: { emoji: '<:BLTail:1514151520936136734>', name: 'Pacific Airlines', key: 'pacific' },
  OV: { emoji: '<:VAS:1514151545745182841>', name: 'VASCO', key: 'vasco' },
};

const AIRLINE_GOLD_EMOJI = '<:goldvna:1514151658014118018>';

const CLASS_CONFIG = {
  economy:         { cost: 100000, color: 0x00B050, emoji: '🟢', label: 'Economy' },
  premium_economy: { cost: 250000, color: 0x3498DB, emoji: '🔵', label: 'Premium Economy' },
  business:        { cost: 500000, color: 0xC4972A, emoji: '💛', label: 'Business' },
};

const BOOKING_BANNER_URL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = { LOGO, FOOTER, COLORS, STATUS_EMOJI, AIRLINE_PREFIX, AIRLINE_GOLD_EMOJI, CLASS_CONFIG, BOOKING_BANNER_URL };
