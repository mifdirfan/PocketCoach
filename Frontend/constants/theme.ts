import { normalize } from './helpers';

// 1. COLORS
// Based on your design drafts
const Colors = {
    // Brand Colors
    primary: '#3a7bd5',
    gradientStart: '#FFFFFF',
    gradientEnd: '#CCCCCC',

    // Text Colors
    textWhite: '#000',
    textBlack: '#333333',
    textGray: '#666666',
    textPlaceholder: '#999999',

    // Background Colors
    backgroundChat: '#f4f7f9',
    cardBackground: '#FFFFFF',

    // Macro Colors
    protein: '#FF6347', // Red
    carbs: '#FFD700',   // Yellow
    fat: '#4682B4',   // Blue

    // Other
    transparent: 'transparent',
    white: '#FFFFFF',
    black: '#000000',
    error: 'red',
    success: 'green',
};

// 2. FONT SIZES
const Fonts = {
    // Headers
    h1: normalize(28),
    h2: normalize(22),
    h3: normalize(18),

    // Special
    circleMain: normalize(30),

    // Body
    body: normalize(16),
    label: normalize(14),
    caption: normalize(12),
};

// 3. SPACING
const Spacing = {
    padding: normalize(20),
    margin: normalize(15),
    radius: normalize(20),
};

// 4. EXPORT THEME
export const theme = {
    Colors,
    Fonts,
    Spacing,
};

export default theme;