const { registerFont } = require('canvas');
const path = require('path');

const fontsDir = path.join(__dirname, 'fonts');
const robotoRegular = path.join(fontsDir, 'Roboto-Regular.ttf');
const robotoBold = path.join(fontsDir, 'Roboto-Bold.ttf');

const FONT_FAMILY_REGULAR = 'Roboto';
const FONT_FAMILY_BOLD = 'Roboto-Bold';

try {
  registerFont(robotoRegular, { family: FONT_FAMILY_REGULAR });
  registerFont(robotoBold, { family: FONT_FAMILY_BOLD });
  console.log('Canvas font registration succeeded:', {
    regular: robotoRegular,
    bold: robotoBold,
    familyRegular: FONT_FAMILY_REGULAR,
    familyBold: FONT_FAMILY_BOLD,
  });
} catch (err) {
  console.warn('Canvas font registration failed:', err.message);
}

module.exports = {
  FONT_FAMILY_REGULAR,
  FONT_FAMILY_BOLD,
};
