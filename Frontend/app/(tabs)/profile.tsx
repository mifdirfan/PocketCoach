import React, { useContext, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    StyleSheet,
    Platform,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// --- Use relative paths ---
import { AppContext, AppContextTypeWithLoading } from '../../context/AppContext';
import { normalize } from '../../constants/helpers';
import { theme } from '../../constants/theme';
import { AlertModal } from '../../components/AlertModal'; // Import our new modal
import { useRouter } from 'expo-router'; // Import useRouter

// --- Profile Info Row Component ---
const InfoRow = ({ label, value, icon }: { label: string, value: string | number, icon: any }) => (
    <View style={styles.infoRow}>
        <Ionicons name={icon} size={normalize(20)} color={theme.Colors.primary} style={styles.infoIcon} />
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

// --- MAIN PROFILE SCREEN ---
export default function ProfileScreen() {
    const context = useContext(AppContext) as AppContextTypeWithLoading;
    const [modalVisible, setModalVisible] = useState(false);
    const router = useRouter(); // For redirecting after deletion

    if (!context || !context.profile) {
        return (
            <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.Colors.white} />
                <Text style={{ color: 'white', marginTop: 10 }}>Loading profile...</Text>
            </LinearGradient>
        );
    }

    const { profile, setProfile } = context;

    const handleDeleteConfirm = () => {
        setProfile(null); // This clears storage
        setModalVisible(false);

        // --- START: FIX ---
        // Use a relative path to navigate up from the (tabs) layout to the root index screen.
        router.replace('../index');
        // --- END: FIX ---
    };

    const calculateAge = (ageString: string) => {
        // This is a placeholder. If 'age' is birth year, you need real logic here.
        // e.g., return new Date().getFullYear() - parseInt(ageString, 10);
        // For now, just returning the stored value.
        return ageString;
    };

    return (
        <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.gradientBackground}>
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Image
                            source={{ uri: `https://placehold.co/120x120/FFFFFF/3a7bd5?text=${profile.name.charAt(0)}` }}
                            style={styles.avatar}
                        />
                        <Text style={styles.headerTitle}>{profile.name}</Text>
                        <Text style={styles.headerSubtitle}>{profile.email}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>My Stats</Text>
                        <InfoRow label="Goal" value={profile.goal.replace('_', ' ')} icon="analytics-outline" />
                        <InfoRow label="Start Weight" value={`${profile.start_weight_kg} kg`} icon="flag-outline" />
                        <InfoRow label="Goal Weight" value={`${profile.goal_weight_kg} kg`} icon="trophy-outline" />
                        <InfoRow label="Current Weight" value={`${profile.weight_kg} kg`} icon="barbell-outline" />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>My Info</Text>
                        <InfoRow label="Height" value={`${profile.height_cm} cm`} icon="body-outline" />
                        <InfoRow label="Age" value={calculateAge(profile.age)} icon="calendar-outline" />
                        <InfoRow label="Gender" value={profile.gender} icon="transgender-outline" />
                        <InfoRow label="BMI" value={profile.bmi} icon="calculator-outline" />
                    </View>

                    {/* --- NEW DELETE BUTTON --- */}
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => setModalVisible(true)}
                    >
                        <Ionicons name="trash-outline" size={normalize(20)} color={theme.Colors.error} />
                        <Text style={styles.deleteButtonText}>Delete Profile</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            {/* --- NEW ALERT MODAL --- */}
            <AlertModal
                visible={modalVisible}
                title="Delete Profile?"
                message={`Are you sure? All existing data for "${profile.name}" will be permanently erased.`}
                onCancel={() => setModalVisible(false)}
                onConfirm={handleDeleteConfirm}
            />
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
    scrollContent: {
        paddingBottom: theme.Spacing.padding,
    },
    header: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? normalize(40) : normalize(20),
        paddingBottom: normalize(20),
    },
    avatar: {
        width: normalize(120),
        height: normalize(120),
        borderRadius: normalize(60),
        borderWidth: 4,
        borderColor: theme.Colors.white,
        marginBottom: normalize(15),
    },
    headerTitle: {
        fontSize: theme.Fonts.h1,
        fontWeight: 'bold',
        color: theme.Colors.textWhite,
    },
    headerSubtitle: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textWhite,
        opacity: 0.8,
        marginTop: normalize(5),
    },
    card: {
        backgroundColor: theme.Colors.cardBackground,
        borderRadius: theme.Spacing.radius,
        padding: theme.Spacing.padding,
        marginHorizontal: theme.Spacing.padding,
        marginBottom: theme.Spacing.margin,
        ...Platform.select({
            ios: {
                shadowColor: theme.Colors.black,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    cardTitle: {
        fontSize: theme.Fonts.h3,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
        marginBottom: normalize(15),
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(12),
        borderBottomWidth: 1,
        borderBottomColor: theme.Colors.backgroundChat,
    },
    infoIcon: {
        marginRight: normalize(15),
    },
    infoLabel: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textGray,
        flex: 1,
    },
    infoValue: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textBlack,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.Colors.cardBackground,
        borderRadius: theme.Spacing.radius,
        padding: theme.Spacing.padding,
        marginHorizontal: theme.Spacing.padding,
        marginTop: normalize(10),
    },
    deleteButtonText: {
        color: theme.Colors.error,
        fontSize: theme.Fonts.body,
        fontWeight: 'bold',
        marginLeft: normalize(10),
    },
});