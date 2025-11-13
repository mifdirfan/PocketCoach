import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Summary } from '@/constants/types';
import { normalize } from '@/constants/helpers';
import { theme } from '@/constants/theme';

// --- 1. NEW: Horizontal Progress Bar Component ---
interface ProgressBarProps {
    percentage: number;
    color: string;
}
const ProgressBar = ({ percentage, color }: ProgressBarProps) => {
    // Clamp percentage between 0 and 100
    const progress = Math.max(0, Math.min(percentage, 100));

    return (
        <View style={styles.progressBarContainer}>
            <View
                style={[
                    styles.progressBar,
                    { width: `${progress}%`, backgroundColor: color },
                ]}
            />
        </View>
    );
};

// --- 2. NEW: Reusable Macro Row for Protein, Carbs, Fat ---
interface MacroRowProps {
    label: string;
    value: number;
    goal: number;
    color: string;
}
const MacroRow = ({ label, value, goal, color }: MacroRowProps) => {
    const percentage = goal > 0 ? (value / goal) * 100 : 0;
    return (
        <View style={styles.macroRowContainer}>
            <Text style={styles.macroRowLabel}>{label}</Text>
            <ProgressBar percentage={percentage} color={color} />
            <Text style={styles.macroRowValue}>{value.toFixed(0)} / {goal.toFixed(0)}g</Text>
        </View>
    );
};

// --- 3. UPDATED: Main MacroSummary Component ---
interface MacroSummaryProps {
    summary: Summary | null;
}
export default function MacroSummary({ summary }: MacroSummaryProps) {

    // --- 4. UPDATED: Empty state now uses the new table layout ---
    const renderEmptyState = () => (
        <View style={styles.card}>
            <Text style={styles.macroCardTitle}>오늘의 매크로</Text>
            <View style={styles.contentContainer}>
                {/* Left Column (Calories) */}
                <View style={styles.column}>
                    <Text style={styles.mainLabel}>Calories</Text>
                    <View style={styles.mainValueContainer}>
                        <Text style={styles.mainValue}>0</Text>
                        <Text style={styles.mainUnit}>kcal</Text>
                    </View>
                    <ProgressBar percentage={0} color={theme.Colors.primary} />
                    <Text style={styles.subText}>0 / 0 kcal</Text>
                </View>
                {/* Right Column (Macros) */}
                <View style={styles.column}>
                    <MacroRow label="Protein" value={0} goal={0} color={theme.Colors.protein} />
                    <MacroRow label="Carbs" value={0} goal={0} color={theme.Colors.carbs} />
                    <MacroRow label="Fat" value={0} goal={0} color={theme.Colors.fat} />
                </View>
            </View>
            <Text style={styles.planText}>오늘의 첫 식사를 기록해주세요!</Text>
        </View>
    );

    if (!summary || !summary.total || !summary.goal || summary.goal.calories === 0) {
        return renderEmptyState();
    }

    const { total, goal } = summary;
    const calPercentage = goal.calories > 0 ? (total.calories / goal.calories) * 100 : 0;

    // --- 5. UPDATED: Main component JSX now uses the new table layout ---
    return (
        <View style={styles.card}>
            <Text style={styles.macroCardTitle}>오늘의 매크로</Text>
            <View style={styles.contentContainer}>
                {/* Left Column (Calories) */}
                <View style={styles.column}>
                    <Text style={styles.mainLabel}>Calories</Text>
                    <View style={styles.mainValueContainer}>
                        <Text style={styles.mainValue}>{total.calories.toFixed(0)}</Text>
                        <Text style={styles.mainUnit}>kcal</Text>
                    </View>
                    <ProgressBar percentage={calPercentage} color={theme.Colors.primary} />
                    <Text style={styles.subText}>
                        {total.calories.toFixed(0)} / {goal.calories.toFixed(0)} kcal
                    </Text>
                </View>
                {/* Right Column (Macros) */}
                <View style={styles.column}>
                    <MacroRow label="Protein" value={total.protein} goal={goal.protein} color={theme.Colors.protein} />
                    <MacroRow label="Carbs" value={total.carbs} goal={goal.carbs} color={theme.Colors.carbs} />
                    <MacroRow label="Fat" value={total.fat} goal={goal.fat} color={theme.Colors.fat} />
                </View>
            </View>
        </View>
    );
}

// --- 6. UPDATED: Stylesheet for the new table layout ---
const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.Colors.cardBackground,
        borderRadius: theme.Spacing.radius,
        marginHorizontal: theme.Spacing.margin,
        paddingVertical: normalize(15), // Adjusted padding
        paddingHorizontal: normalize(10), // Adjusted padding
        shadowColor: theme.Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: normalize(10),
    },
    macroCardTitle: {
        fontSize: theme.Fonts.h3,
        fontWeight: '600',
        color: theme.Colors.textBlack,
        marginBottom: normalize(12),
        paddingHorizontal: normalize(5), // Align title with column padding
    },
    contentContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    column: {
        flex: 1,
        paddingHorizontal: normalize(5),
    },
    mainLabel: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textGray,
        fontWeight: '500',
        marginBottom: normalize(5),
    },
    mainValueContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: normalize(5),
    },
    mainValue: {
        fontSize: theme.Fonts.h1, // Large font for calories
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
        lineHeight: normalize(32), // Adjust line height to match font
    },
    mainUnit: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        fontWeight: '500',
        marginLeft: normalize(4),
        marginBottom: normalize(3), // Align baseline with main value
    },
    subText: {
        fontSize: theme.Fonts.caption,
        color: theme.Colors.textGray,
        marginTop: normalize(5),
    },
    progressBarContainer: {
        height: normalize(8), // Skinny progress bar
        backgroundColor: theme.Colors.backgroundChat, // Inactive color
        borderRadius: normalize(4),
        overflow: 'hidden', // Ensures progress bar stays within border
    },
    progressBar: {
        height: '100%',
        borderRadius: normalize(4),
    },
    macroRowContainer: {
        marginBottom: normalize(10), // Space between protein, carbs, fat
    },
    macroRowLabel: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textBlack,
        fontWeight: '600',
        marginBottom: normalize(4),
    },
    macroRowValue: {
        fontSize: theme.Fonts.caption,
        color: theme.Colors.textGray,
        marginTop: normalize(4),
    },
    planText: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        marginTop: normalize(15),
        textAlign: 'center',
        paddingHorizontal: normalize(5),
    },
});