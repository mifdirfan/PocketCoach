import React, { useState, useContext } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    Alert,
    StyleSheet,
    Platform,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AppContext, AppContextTypeWithLoading } from '../context/AppContext'; // Use relative path
import { API_BASE_URL } from '../constants/api'; // Use relative path
import { Profile, GoalType } from '../constants/types'; // Use relative path
import { LinearGradient } from 'expo-linear-gradient';
import { normalize } from '../constants/helpers'; // Use relative path
import { theme } from '../constants/theme'; // Use relative path
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // Import useRouter

// --- (Custom Button, Card, InfoInput components remain the same) ---
const CustomButton = ({ title, onPress }: { title: string, onPress: () => void }) => {
    return (
        <TouchableOpacity onPress={onPress}>
            <LinearGradient
                colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.customButton}
            >
                <Text style={styles.customButtonText}>{title}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
};
const Card = ({ children, style }: { children: React.ReactNode, style?: object }) => (
    <View style={[styles.card, style]}>{children}</View>
);
interface InfoInputProps {
    label: string;
    value: string;
    placeholder: string;
    unit: string;
    keyboardType?: 'numeric' | 'default';
    onChangeText: (text: string) => void;
}
const InfoInput: React.FC<InfoInputProps> = ({
                                                 label,
                                                 value,
                                                 placeholder,
                                                 unit,
                                                 keyboardType = 'numeric',
                                                 onChangeText,
                                             }) => (
    <View style={styles.infoInputContainer}>
        <Text style={styles.infoInputLabel}>{label}</Text>
        <View style={styles.infoInputValueRow}>
            <TextInput
                style={styles.infoInputValue}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.Colors.textPlaceholder}
                keyboardType={keyboardType}
            />
            <Text style={styles.infoInputUnit}>{unit}</Text>
        </View>
    </View>
);


// --- MAIN ONBOARDING SCREEN ---
export default function OnboardingScreen() {
    const context = useContext(AppContext) as AppContextTypeWithLoading;
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false); // Loading state for submit

    // --- 1. REMOVED body_fat_percentage from state ---
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        gender: 'male' as 'male' | 'female',
        age: '',
        height_cm: '',
        weight_kg: '', // This will be set as start_weight_kg
        goal_weight_kg: '',
        goal: 'weight_loss' as GoalType,
        activity_level: 'low' as 'low' | 'moderate' | 'high',
        allergies: '',
    });

    if (!context) {
        return (
            <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.Colors.white} />
            </LinearGradient>
        );
    }

    const { setProfile } = context;

    const handleInputChange = (key: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleGoalChange = (goal: GoalType) => {
        setFormData(prev => ({ ...prev, goal }));
    };

    const calculateBMI = (weight: string, height: string): string => {
        const w = parseFloat(weight);
        const h = parseFloat(height) / 100;
        if (w > 0 && h > 0) {
            const bmi = w / (h * h);
            return bmi.toFixed(1);
        }
        return '';
    };

    // --- Form Submission ---
    const handleSubmit = () => {
        // --- 2. REMOVED body_fat_percentage from required fields ---
        const requiredFields = [
            'name', 'email', 'gender', 'age', 'height_cm', 'weight_kg',
            'goal_weight_kg', 'goal', 'activity_level'
        ] as const;

        for (const key of requiredFields) {
            if (!formData[key]) {
                Alert.alert('Info Missing', `Please fill out the "${key}" field.`);
                return;
            }
        }

        const bmi = calculateBMI(formData.weight_kg, formData.height_cm);
        if (bmi === '') {
            Alert.alert('Calculation Error', 'Please enter valid Weight and Height.');
            return;
        }

        // --- 3. REMOVED body_fat_percentage from final object ---
        // (It will now default to "0" on the backend)
        const finalProfile: Omit<Profile, 'status' | 'plans' | 'body_fat_percentage'> = {
            ...formData,
            bmi: bmi,
            start_weight_kg: formData.weight_kg,
            name: formData.name,
            email: formData.email,
            gender: formData.gender,
            age: formData.age,
            height_cm: formData.height_cm,
            weight_kg: formData.weight_kg,
            goal_weight_kg: formData.goal_weight_kg,
            goal: formData.goal,
            activity_level: formData.activity_level,
            allergies: formData.allergies || 'None',
        };

        setIsLoading(true); // Start loading

        fetch(`${API_BASE_URL}/save_profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalProfile),
        })
            .then(res => res.json())
            .then((savedProfile: Profile) => {
                
                setProfile(savedProfile);
                setIsLoading(false);
                // Redirect to the main app (tabs)
                router.replace('/(tabs)');
            })
            .catch(err => {
                setIsLoading(false);
                console.error(err);
                Alert.alert('Connection Error', `Could not save profile: ${err.message}`);
            });
    };

    return (
        <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.gradientBackground}>
            <SafeAreaView style={styles.container}>
                <KeyboardAwareScrollView
                    contentContainerStyle={styles.scrollContent}
                    enableOnAndroid={true}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.onboardingTitle}>Create your profile</Text>

                    {/* ... (Card: Personal Info is unchanged) ... */}
                    <Card>
                        <Text style={styles.cardTitle}>Personal Info</Text>
                        <InfoInput
                            label="Name"
                            value={formData.name || ''}
                            placeholder="e.g., Mifdzal Irfan"
                            unit=""
                            keyboardType="default"
                            onChangeText={v => handleInputChange('name', v)}
                        />
                        <View style={{height: normalize(15)}} />
                        <InfoInput
                            label="Email"
                            value={formData.email || ''}
                            placeholder="e.g., user@email.com"
                            unit=""
                            keyboardType="default"
                            onChangeText={v => handleInputChange('email', v)}
                        />
                    </Card>

                    {/* ... (Card: Gender is unchanged) ... */}
                    <Card>
                        <Text style={styles.cardTitle}>Gender</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                onPress={() => handleInputChange('gender', 'male')}
                                style={[styles.segmentButton, formData.gender === 'male' && styles.segmentButtonActive]}
                            >
                                <Ionicons name="male" size={normalize(20)} color={formData.gender === 'male' ? theme.Colors.primary : theme.Colors.textGray} />
                                <Text style={[styles.segmentButtonText, formData.gender === 'male' && styles.segmentButtonTextActive]}>Male</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleInputChange('gender', 'female')}
                                style={[styles.segmentButton, formData.gender === 'female' && styles.segmentButtonActive]}
                            >
                                <Ionicons name="female" size={normalize(20)} color={formData.gender === 'female' ? theme.Colors.primary : theme.Colors.textGray} />
                                <Text style={[styles.segmentButtonText, formData.gender === 'female' && styles.segmentButtonTextActive]}>Female</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>

                    {/* Card: Body Measurement */}
                    <Card>
                        <Text style={styles.cardTitle}>Body Measurement</Text>
                        <InfoInput label="Age" value={formData.age || ''} placeholder="25" unit="Years" onChangeText={v => handleInputChange('age', v)} />
                        <InfoInput label="Height" value={formData.height_cm || ''} placeholder="170" unit="cm" onChangeText={v => handleInputChange('height_cm', v)} />
                        <InfoInput label="Start Weight" value={formData.weight_kg || ''} placeholder="70" unit="kg" onChangeText={v => handleInputChange('weight_kg', v)} />
                        <InfoInput label="Goal Weight" value={formData.goal_weight_kg || ''} placeholder="65" unit="kg" onChangeText={v => handleInputChange('goal_weight_kg', v)} />

                        {/* --- 4. REMOVED Body Fat % Input --- */}

                    </Card>

                    {/* ... (Card: Goal is unchanged) ... */}
                    <Card>
                        <Text style={styles.cardTitle}>Goal</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                onPress={() => handleGoalChange('weight_loss')}
                                style={[styles.segmentButton, formData.goal === 'weight_loss' && styles.segmentButtonActive]}
                            >
                                <Text style={[styles.segmentButtonText, formData.goal === 'weight_loss' && styles.segmentButtonTextActive]}>Weight Loss</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleGoalChange('muscle_gain')}
                                style={[styles.segmentButton, formData.goal === 'muscle_gain' && styles.segmentButtonActive]}
                            >
                                <Text style={[styles.segmentButtonText, formData.goal === 'muscle_gain' && styles.segmentButtonTextActive]}>Muscle Gain</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleGoalChange('recomposition')}
                                style={[styles.segmentButton, formData.goal === 'recomposition' && styles.segmentButtonActive]}
                            >
                                <Text style={[styles.segmentButtonText, formData.goal === 'recomposition' && styles.segmentButtonTextActive]}>Body Recomp</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>

                    {/* ... (Card: Activity Level is unchanged) ... */}
                    <Card>
                        <Text style={styles.cardTitle}>Activity Level</Text>
                        <View style={styles.segmentedControl}>
                            {['low', 'moderate', 'high'].map(level => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.segmentButton,
                                        formData.activity_level === level && styles.segmentButtonActive
                                    ]}
                                    onPress={() => handleInputChange('activity_level', level)}
                                >
                                    <Text style={[
                                        styles.segmentButtonText,
                                        formData.activity_level === level && styles.segmentButtonTextActive
                                    ]}>
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>

                    {/* ... (Card: Allergies is unchanged) ... */}
                    <Card>
                        <Text style={styles.cardTitle}>Allergies (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="None (e.g., peanuts, shellfish)"
                            placeholderTextColor={theme.Colors.textPlaceholder}
                            value={formData.allergies}
                            onChangeText={v => handleInputChange('allergies', v)}
                        />
                    </Card>

                    {/* Button: Continue (With loading state) */}
                    <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
                        <LinearGradient
                            colors={isLoading ? [theme.Colors.textGray, theme.Colors.textPlaceholder] : [theme.Colors.gradientStart, theme.Colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.customButton}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={theme.Colors.white} />
                            ) : (
                                <Text style={styles.customButtonText}>Continue</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                </KeyboardAwareScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

// --- (Styles are unchanged) ---
const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradientBackground: { flex: 1 },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? normalize(30) : 0,
    },
    scrollContent: {
        padding: theme.Spacing.padding,
    },
    onboardingTitle: {
        fontSize: theme.Fonts.h1,
        fontWeight: 'bold',
        color: theme.Colors.textWhite,
        textAlign: 'center',
        marginBottom: normalize(25),
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
    cardTitle: {
        fontSize: theme.Fonts.h3,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
        marginBottom: normalize(15),
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: theme.Colors.backgroundChat,
        borderRadius: normalize(10),
        overflow: 'hidden',
    },
    segmentButton: {
        flex: 1,
        padding: normalize(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentButtonActive: {
        backgroundColor: theme.Colors.white,
        shadowColor: theme.Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
        borderRadius: normalize(10),
    },
    segmentButtonText: {
        color: theme.Colors.textGray,
        fontWeight: '600',
        fontSize: theme.Fonts.body,
        marginLeft: normalize(8),
    },
    segmentButtonTextActive: {
        color: theme.Colors.primary,
        fontWeight: 'bold',
    },
    infoInputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: normalize(10),
        borderBottomWidth: 1,
        borderBottomColor: theme.Colors.backgroundChat,
    },
    infoInputLabel: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textGray,
        fontWeight: '500',
    },
    infoInputValueRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    infoInputValue: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textBlack,
        fontWeight: '600',
        minWidth: normalize(50),
        textAlign: 'right',
    },
    infoInputUnit: {
        fontSize: theme.Fonts.label,
        color: theme.Colors.textGray,
        fontWeight: '500',
        marginLeft: normalize(5),
        paddingBottom: normalize(2),
    },
    textInput: {
        backgroundColor: theme.Colors.backgroundChat,
        borderRadius: normalize(10),
        padding: normalize(15),
        fontSize: theme.Fonts.body,
        color: theme.Colors.textBlack,
    },
    customButton: {
        padding: normalize(18),
        borderRadius: normalize(30),
        alignItems: 'center',
        shadowColor: theme.Colors.black,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
        marginTop: normalize(10),
    },
    customButtonText: {
        color: theme.Colors.textWhite,
        fontSize: theme.Fonts.h3,
        fontWeight: 'bold',
    },
});