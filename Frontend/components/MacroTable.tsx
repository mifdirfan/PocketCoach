import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Summary } from '../constants/types'; // Import the Summary type

interface MacroTableProps {
    summary: Summary | null;
}

export default function MacroTable({ summary }: MacroTableProps) {
    if (!summary || !summary.total || !summary.goal) {
        return null;
    }

    const { total, goal } = summary;

    const remaining = {
        calories: (goal.calories || 0) - (total.calories || 0),
        protein: (goal.protein || 0) - (total.protein || 0),
        carbs: (goal.carbs || 0) - (total.carbs || 0),
        fat: (goal.fat || 0) - (total.fat || 0),
    };

    return (
        <View style={styles.table}>
            <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>Nutrient</Text>
                <Text style={styles.tableHeaderText}>Total</Text>
                <Text style={styles.tableHeaderText}>Goal</Text>
                <Text style={styles.tableHeaderText}>Remaining</Text>
            </View>
            {Object.keys(total).map(key => (
                <View style={styles.tableRow} key={key}>
                    <Text style={styles.tableCell}>{key}</Text>
                    <Text style={styles.tableCell}>{total[key as keyof typeof total].toFixed(0)}</Text>
                    <Text style={styles.tableCell}>{goal[key as keyof typeof goal].toFixed(0)}</Text>
                    <Text style={styles.tableCell}>{remaining[key as keyof typeof remaining].toFixed(0)}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    table: {
        padding: 10,
        backgroundColor: '#f9f9f9',
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#ddd',
        paddingBottom: 5,
    },
    tableHeaderText: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        marginTop: 5,
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
    },
});