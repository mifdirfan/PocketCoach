import { Dimensions, PixelRatio } from 'react-native';

// --- Screen Sizing ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;

export const normalize = (size: number): number => {
    const newSize = size * scale;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// --- Date Formatting ---
export const formatQueryDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    };
    return date.toLocaleDateString('en-GB', options);
};