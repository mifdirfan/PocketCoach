import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    StyleSheet,
    Platform,
    TouchableOpacity,
    Alert,
    Modal,
    ActivityIndicator,
    Linking,
    Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CircularProgress from 'react-native-circular-progress-indicator';
import { AppContext } from '../../context/AppContext';
import { AppContextType, Summary, DietPlan, WorkoutPlan, Exercise } from '../../constants/types';
import { normalize, formatQueryDate } from '../../constants/helpers';
import { theme } from '../../constants/theme';
import { API_BASE_URL } from '../../constants/api';

// --- 1. Date Picker Component ---
const DateSelector = ({
                          selectedDate,
                          onDateChange,
                      }: {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}) => {
    const [dates, setDates] = useState<Date[]>([]);

    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dayList: Date[] = [];
        for (let i = -3; i <= 3; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            dayList.push(date);
        }
        setDates(dayList);
    }, []);

    const getDayAbbreviation = (dayIndex: number) => {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datePickerContainer}
        >
            {dates.map((date, index) => {
                const isSelected =
                    date.toDateString() === selectedDate.toDateString();
                const isToday =
                    date.toDateString() === new Date().toDateString();

                return (
                    <TouchableOpacity
                        key={index}
                        style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                        onPress={() => onDateChange(date)}
                    >
                        <Text style={[styles.dateButtonDay, isSelected && styles.dateButtonTextSelected]}>
                            {getDayAbbreviation(date.getDay())}
                        </Text>
                        <Text style={[styles.dateButtonDate, isSelected && styles.dateButtonTextSelected]}>
                            {date.getDate()}
                        </Text>
                        {isToday && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

// --- 2. Small Macro Circle Component ---
const MacroCircle = ({ label, value, goal, color }: { label: string, value: number, goal: number, color: string }) => {
    const percentage = goal > 0 ? (value / goal) * 100 : 0;
    return (
        <View style={styles.circleContainer}>
            <CircularProgress
                value={percentage > 100 ? 100 : percentage}
                radius={normalize(35)}
                duration={1000}
                progressValueColor={color}
                activeStrokeColor={color}
                inActiveStrokeColor={color}
                inActiveStrokeOpacity={0.2}
                progressValueStyle={{ fontWeight: '600', fontSize: normalize(14) }}
                valueSuffix={'%'}
            />
            <Text style={styles.circleLabel}>{label}</Text>
            <Text style={styles.circleValue}>{value.toFixed(0)} / {goal.toFixed(0)}g</Text>
        </View>
    );
};

// --- 3. Diet Plan Card Component ---
const DietPlanCard = ({ summary, date }: { summary: Summary | null, date: Date }) => {
    const isToday = date.toDateString() === new Date().toDateString();

    const renderEmptyState = () => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Diet Plan</Text>
                <Text style={styles.cardSubtitle}>{isToday ? "Today" : "Goal"}</Text>
            </View>
            <View style={styles.mainCircleContainer}>
                <CircularProgress
                    value={0}
                    radius={normalize(70)}
                    progressValueColor={theme.Colors.textBlack}
                    activeStrokeColor={theme.Colors.primary}
                    inActiveStrokeColor={theme.Colors.primary}
                    inActiveStrokeOpacity={0.2}
                    progressValueStyle={{ fontWeight: 'bold', fontSize: theme.Fonts.circleMain }}
                    valueSuffix={'kcal'}
                    showProgressValue={false}
                />
                <View style={styles.mainCircleTextContainer}>
                    <Text style={styles.mainCircleValue}>0</Text>
                    <Text style={styles.mainCircleLabel}>/ 0 kcal</Text>
                </View>
            </View>
            <View style={styles.subCirclesContainer}>
                <MacroCircle label="Protein" value={0} goal={0} color={theme.Colors.protein} />
                <MacroCircle label="Carbs" value={0} goal={0} color={theme.Colors.carbs} />
                <MacroCircle label="Fat" value={0} goal={0} color={theme.Colors.fat} />
            </View>
        </View>
    );

    if (!summary || !summary.total || !summary.goal || summary.goal.calories === 0) {
        return renderEmptyState();
    }

    const { total, goal } = summary;
    const calPercentage = goal.calories > 0 ? (total.calories / goal.calories) * 100 : 0;

    // Show GOAL numbers if it's not today. Show TOTAL numbers if it is today.
    const displayTotal = isToday ? total : goal;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Diet Plan</Text>
                <Text style={styles.cardSubtitle}>{isToday ? "Today's Progress" : "Planned Goal"}</Text>
            </View>
            <View style={styles.mainCircleContainer}>
                <CircularProgress
                    value={calPercentage > 100 ? 100 : calPercentage}
                    radius={normalize(70)}
                    duration={1000}
                    progressValueColor={theme.Colors.textBlack}
                    activeStrokeColor={theme.Colors.primary}
                    inActiveStrokeColor={theme.Colors.primary}
                    inActiveStrokeOpacity={0.2}
                    progressValueStyle={{ fontWeight: 'bold', fontSize: theme.Fonts.circleMain, color: theme.Colors.primary }}
                    valueSuffix={'%'}
                />
                <View style={styles.mainCircleTextContainer}>
                    <Text style={styles.mainCircleValue}>{displayTotal.calories.toFixed(0)}</Text>
                    <Text style={styles.mainCircleLabel}>/ {goal.calories.toFixed(0)} kcal</Text>
                </View>
            </View>
            <View style={styles.subCirclesContainer}>
                <MacroCircle label="Protein" value={displayTotal.protein} goal={goal.protein} color={theme.Colors.protein} />
                <MacroCircle label="Carbs" value={displayTotal.carbs} goal={goal.carbs} color={theme.Colors.carbs} />
                <MacroCircle label="Fat" value={displayTotal.fat} goal={goal.fat} color={theme.Colors.fat} />
            </View>
        </View>
    );
};

// --- 4. Workout Plan Card Component ---
const WorkoutPlanCard = ({
                             plan,
                             date,
                             onPlayVideo,
                         }: {
    plan: WorkoutPlan | undefined;
    date: Date;
    onPlayVideo: (url: string) => void;
}) => {
    const isToday = date.toDateString() === new Date().toDateString();

    if (!plan || !plan.exercises || plan.exercises.length === 0) {
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Workout Plan</Text>
                    <Text style={styles.cardSubtitle}>{isToday ? "Today" : "Planned"}</Text>
                </View>
                <View style={styles.emptyWorkoutContainer}>
                    <Ionicons name="moon-outline" size={normalize(40)} color={theme.Colors.textGray} />
                    <Text style={styles.emptyWorkoutText}>Rest Day</Text>
                    <Text style={styles.emptyWorkoutSubtext}>Enjoy your recovery!</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Workout Plan</Text>
                <Text style={styles.cardSubtitle}>{isToday ? "Today" : "Planned"}</Text>
            </View>
            <View style={styles.workoutHeader}>
                <Ionicons name="barbell" size={normalize(40)} color={theme.Colors.primary} />
                <View>
                    <Text style={styles.workoutTitle}>{plan.day}</Text>
                    <Text style={styles.workoutSubtext}>{plan.exercises.length} Exercises</Text>
                </View>
            </View>
            <View style={styles.exerciseList}>
                {plan.exercises.map((ex: Exercise, index: number) => (
                    <View key={`${ex.name}-${index}`} style={styles.exerciseCard}>
                        <Image
                            source={{ uri: `https://placehold.co/100x100/f0f0f0/333?text=${ex.name.substring(0,1)}` }}
                            style={styles.exerciseImage}
                        />
                        <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{ex.name}</Text>
                            <Text style={styles.exerciseReps}>{ex.sets_reps}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.playButton}
                            onPress={() => {
                                if (ex.youtube_link) {
                                    onPlayVideo(ex.youtube_link);
                                } else {
                                    Alert.alert('No Video', 'No YouTube link is available for this exercise.');
                                }
                            }}
                        >
                            <Ionicons name="play" size={normalize(20)} color={theme.Colors.primary} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </View>
    );
};

// --- 5. MAIN PLAN SCREEN ---
export default function PlanScreen() {
    const context = useContext(AppContext);
    const [modalVisible, setModalVisible] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [summary, setSummary] = useState<Summary | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());

    if (!context) {
        return (
            <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.Colors.white} />
            </LinearGradient>
        );
    }
    const { profile } = context;

    // Fetch summary data when the selected date changes
    const fetchSummary = useCallback((date: Date) => {
        const dateString = formatQueryDate(date);
        fetch(`${API_BASE_URL}/get_summary?date=${dateString}`)
            .then(res => res.json())
            .then((data: Summary) => setSummary(data))
            .catch(err => console.error("Summary fetch error:", err));
    }, []);

    useEffect(() => {
        if (profile) { // Only fetch summary if profile is loaded
            fetchSummary(selectedDate);
        }
    }, [selectedDate, fetchSummary, profile]);

    const onPlayVideo = (url: string) => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            setVideoUrl(url);
            setModalVisible(true);
        } else {
            Linking.openURL(url);
        }
    };

    // Find the correct workout plan for the selected day
    const dayOfWeek = selectedDate.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    const todaysWorkout = profile?.plans?.workout_plan.find(
        (p: WorkoutPlan) => p.day.toLowerCase().includes(dayName.toLowerCase())
    );

    return (
        <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.gradientBackground}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Plan</Text>
                </View>

                <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <DietPlanCard summary={summary} date={selectedDate} />
                    <WorkoutPlanCard plan={todaysWorkout} date={selectedDate} onPlayVideo={onPlayVideo} />
                </ScrollView>
            </SafeAreaView>

            <Modal
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
                animationType="slide"
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.Colors.black, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close Video</Text>
                    </TouchableOpacity>
                    <WebView source={{ uri: videoUrl }} style={{ flex: 1 }} />
                </SafeAreaView>
            </Modal>
        </LinearGradient>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    gradientBackground: { flex: 1 },
    container: { flex: 1 },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: theme.Spacing.padding,
        paddingTop: Platform.OS === 'android' ? normalize(40) : normalize(20),
        paddingBottom: normalize(10),
    },
    headerTitle: {
        fontSize: theme.Fonts.h1,
        fontWeight: 'bold',
        color: theme.Colors.textWhite,
    },
    scrollContent: {
        paddingHorizontal: theme.Spacing.padding,
        paddingBottom: theme.Spacing.padding,
    },
    datePickerContainer: {
        paddingLeft: theme.Spacing.padding,
        paddingRight: normalize(10),
        paddingVertical: normalize(15),
    },
    dateButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: normalize(15),
        paddingVertical: normalize(12),
        paddingHorizontal: normalize(15),
        marginRight: normalize(10),
        alignItems: 'center',
        minWidth: normalize(60),
    },
    dateButtonSelected: {
        backgroundColor: theme.Colors.white,
    },
    dateButtonDay: {
        fontSize: theme.Fonts.caption,
        fontWeight: '600',
        color: theme.Colors.white,
        opacity: 0.8,
    },
    dateButtonDate: {
        fontSize: normalize(18),
        fontWeight: 'bold',
        color: theme.Colors.white,
        marginTop: normalize(4),
    },
    dateButtonTextSelected: {
        color: theme.Colors.primary,
    },
    todayDot: {
        width: normalize(5),
        height: normalize(5),
        borderRadius: normalize(2.5),
        backgroundColor: theme.Colors.white,
        marginTop: normalize(4),
    },
    card: {
        backgroundColor: theme.Colors.cardBackground,
        borderRadius: theme.Spacing.radius,
        padding: theme.Spacing.padding,
        marginBottom: theme.Spacing.margin,
        shadowColor: theme.Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: normalize(20),
    },
    cardTitle: {
        fontSize: theme.Fonts.h3,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
    },
    cardSubtitle: {
        fontSize: theme.Fonts.label,
        fontWeight: '600',
        color: theme.Colors.textGray,
    },
    mainCircleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: normalize(20),
    },
    mainCircleTextContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainCircleValue: {
        fontSize: theme.Fonts.circleMain,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
    },
    mainCircleLabel: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        marginTop: normalize(5),
    },
    subCirclesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    circleContainer: {
        alignItems: 'center',
    },
    circleLabel: {
        fontSize: theme.Fonts.label,
        fontWeight: '600',
        color: theme.Colors.textBlack,
        marginTop: normalize(10),
    },
    circleValue: {
        fontSize: theme.Fonts.caption,
        color: theme.Colors.textGray,
        marginTop: normalize(3),
    },
    workoutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.Colors.backgroundChat,
        borderRadius: normalize(15),
        padding: normalize(15),
        marginBottom: normalize(15),
    },
    workoutTitle: {
        fontSize: theme.Fonts.body,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
        marginLeft: normalize(15),
    },
    workoutSubtext: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        marginLeft: normalize(15),
    },
    exerciseList: {
        width: '100%',
    },
    exerciseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.Colors.white,
        borderRadius: normalize(15),
        padding: normalize(10),
        marginBottom: normalize(10),
        borderWidth: 1,
        borderColor: theme.Colors.backgroundChat,
    },
    exerciseImage: {
        width: normalize(50),
        height: normalize(50),
        borderRadius: normalize(10),
        backgroundColor: theme.Colors.backgroundChat, // Placeholder BG
    },
    exerciseInfo: {
        flex: 1,
        marginLeft: normalize(15),
    },
    exerciseName: {
        fontSize: theme.Fonts.body,
        fontWeight: '600',
        color: theme.Colors.textBlack,
    },
    exerciseReps: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        marginTop: normalize(4),
    },
    playButton: {
        width: normalize(40),
        height: normalize(40),
        borderRadius: normalize(20),
        backgroundColor: 'rgba(58, 123, 213, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyWorkoutContainer: {
        alignItems: 'center',
        paddingVertical: normalize(30),
    },
    emptyWorkoutText: {
        fontSize: theme.Fonts.h3,
        fontWeight: '600',
        color: theme.Colors.textBlack,
        marginTop: normalize(10),
    },
    emptyWorkoutSubtext: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textGray,
        marginTop: normalize(5),
    },
    closeButton: {
        padding: normalize(15),
        backgroundColor: theme.Colors.primary,
        alignItems: 'center',
    },
    closeButtonText: {
        color: theme.Colors.white,
        fontSize: theme.Fonts.body,
        fontWeight: 'bold',
    },
});