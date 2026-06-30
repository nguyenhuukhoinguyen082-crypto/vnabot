// ─────────────────────────────────────────────────────────────────────────────
// Vietnam Airlines Group | PTFS — Seat Map Engine
// Aircraft configs updated to VNA fleet
// ─────────────────────────────────────────────────────────────────────────────

const CONFIGS = {
  '787-9': {
    name: 'Boeing 787-9 Dreamliner',
    totalRows: 35,
    cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    businessRows: [1, 2, 3, 4, 5, 6],
    premiumRows: [7, 8, 9, 10, 11],
    exitRows: [12, 20],
    businessCols: ['A', 'B', 'D', 'E', 'G', 'H'],
    premiumCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    economyCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
  },
  '787-10': {
    name: 'Boeing 787-10 Dreamliner',
    totalRows: 40,
    cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    businessRows: [1, 2, 3, 4, 5, 6],
    premiumRows: [7, 8, 9, 10, 11],
    exitRows: [12, 24],
    businessCols: ['A', 'B', 'D', 'E', 'G', 'H'],
    premiumCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    economyCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
  },
  'a350-900': {
    name: 'Airbus A350-900',
    totalRows: 38,
    cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    businessRows: [1, 2, 3, 4, 5, 6, 7, 8],
    premiumRows: [9, 10, 11, 12],
    exitRows: [14, 25],
    businessCols: ['A', 'B', 'D', 'E', 'G', 'H'],
    premiumCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    economyCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
  },
  'a321neo': {
    name: 'Airbus A321neo',
    totalRows: 30,
    cols: ['A', 'B', 'C', 'D', 'E', 'F'],
    businessRows: [],
    exitRows: [15, 16],
    businessCols: [],
    economyCols: ['A', 'B', 'C', 'D', 'E', 'F'],
  },
  'a330-300': {
    name: 'Airbus A330-300',
    totalRows: 42,
    cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    businessRows: [1, 2, 3, 4],
    exitRows: [10, 30],
    businessCols: ['A', 'B', 'D', 'E', 'G', 'H'],
    economyCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  },
};

const DEFAULT_CONFIG = CONFIGS['a321neo'];

function detectConfig(aircraftName) {
  if (!aircraftName) return DEFAULT_CONFIG;
  const name = aircraftName.toLowerCase().replace(/\s+/g, '');
  if (name.includes('787-10') || name.includes('78710')) return CONFIGS['787-10'];
  if (name.includes('787-9') || name.includes('7879') || name.includes('787')) return CONFIGS['787-9'];
  if (name.includes('a350')) return CONFIGS['a350-900'];
  if (name.includes('a330')) return CONFIGS['a330-300'];
  if (name.includes('a321')) return CONFIGS['a321neo'];
  return DEFAULT_CONFIG;
}

function getPageCount(config, rowsPerPage = 10) {
  return Math.ceil(config.totalRows / rowsPerPage);
}

function getRowsForPage(config, page, rowsPerPage = 10) {
  const start = page * rowsPerPage + 1;
  const end = Math.min((page + 1) * rowsPerPage, config.totalRows);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function buildSeatMap(config, takenSeats, selectedSeat, page = 0, rowsPerPage = 10) {
  const takenSet = new Set((takenSeats || []).map(s => s.toUpperCase()));
  const rows = getRowsForPage(config, page, rowsPerPage);

  const cols = config.economyCols || config.cols;
  const header = `\`     ${cols.join('  ')}\``;
  const lines = [header];

  for (const row of rows) {
    const isBiz = config.businessRows.includes(row);
    const isExit = config.exitRows.includes(row);
    const rowCols = isBiz ? (config.businessCols || cols) : cols;

    let line = `\`${String(row).padStart(3)}  \``;
    for (const col of cols) {
      if (!rowCols.includes(col)) {
        line += ' ░ ';
        continue;
      }
      const seatId = `${row}${col}`;
      if (seatId.toUpperCase() === (selectedSeat || '').toUpperCase()) {
        line += '🟨';
      } else if (takenSet.has(seatId.toUpperCase())) {
        line += '🟥';
      } else {
        line += '🟩';
      }
    }
    if (isBiz) line += ' `💼`';
    if (isExit) line += ' `🚪`';
    lines.push(line);
  }

  return lines.join('\n');
}

function getRowOptions(config, page, takenSeats, rowsPerPage = 10) {
  const takenSet = new Set((takenSeats || []).map(s => s.toUpperCase()));
  const rows = getRowsForPage(config, page, rowsPerPage);

  return rows.map(row => {
    const isBiz = config.businessRows.includes(row);
    const isPrem = (config.premiumRows || []).includes(row);
    const isExit = config.exitRows.includes(row);
    const rowCols = isBiz
      ? (config.businessCols || config.cols)
      : isPrem
        ? (config.premiumCols || config.cols)
        : (config.economyCols || config.cols);
    const availableInRow = rowCols.filter(col => !takenSet.has(`${row}${col}`.toUpperCase()));
    const classLabel = isBiz ? ' — Business' : isPrem ? ' — Premium Economy' : ' — Economy';
    const label = `Row ${row}${classLabel}${isExit ? ' (Exit)' : ''} — ${availableInRow.length} free`;

    return {
      label: label.slice(0, 100),
      value: String(row),
      description: availableInRow.length === 0 ? 'Full' : `Seats: ${availableInRow.join(', ')}`,
    };
  }).filter(opt => opt.description !== 'Full');
}

module.exports = { detectConfig, buildSeatMap, getPageCount, getRowOptions, getRowsForPage, CONFIGS };
