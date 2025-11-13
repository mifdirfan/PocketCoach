import React, { useContext, useState } from 'react';
import {
    ActivityIndicator,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme'; // FIX: Changed path
import { AppContext, AppContextTypeWithLoading } from '../context/AppContext'; // FIX: Changed path
import { useRouter } from 'expo-router';
import { normalize } from '../constants/helpers'; // FIX: Changed path
import { Ionicons } from '@expo/vector-icons';
import { AlertModal } from '../components/AlertModal'; // FIX: Changed path

export default function WelcomeScreen() {
    const context = useContext(AppContext) as AppContextTypeWithLoading;
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);

    // 1. Show loader while profile is being restored
    if (!context || context.isRestoring) {
        return (
            <LinearGradient
                colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]}
                style={styles.loaderContainer}
            >
                <ActivityIndicator size="large" color={theme.Colors.white} />
            </LinearGradient>
        );
    }

    const { profile, setProfile } = context;

    // 2. Handle the "Create New / Delete" flow
    const handleCreateNew = () => {
        if (profile) {
            // If a profile exists, show confirmation modal
            setModalVisible(true);
        } else {
            // No profile, just go to onboarding
            router.replace('/onboarding');
        }
    };

    const handleDeleteConfirm = () => {
        setProfile(null); // This clears storage
        setModalVisible(false);
        router.replace('/onboarding');
    };

    // 3. Handle continuing with existing profile
    const handleContinue = () => {
        router.replace('/(tabs)');
    };

    return (
        <LinearGradient
            colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]}
            style={styles.container}
        >
            <View style={styles.content}>
                <Ionicons name="fitness" size={normalize(80)} color={theme.Colors.white} />
                <Text style={styles.title}>Welcome to PocketCoach</Text>

                {profile ? (
                    <>
                        <Text style={styles.subtitle}>Welcome back, {profile.name}!</Text>
                        <TouchableOpacity style={styles.button} onPress={handleContinue}>
                            <Text style={styles.buttonText}>Continue as {profile.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={handleCreateNew}
                        >
                            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                                Create New Profile
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.subtitle}>Let's start your fitness journey.</Text>
                        <TouchableOpacity style={styles.button} onPress={handleCreateNew}>
                            <Text style={styles.buttonText}>Create New Profile</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <AlertModal
                visible={modalVisible}
                title="Delete Profile?"
                message={`Are you sure? All existing data for "${profile?.name}" will be permanently erased.`}
                onCancel={() => setModalVisible(false)}
                onConfirm={handleDeleteConfirm}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: theme.Spacing.padding,
    },
    title: {
        fontSize: theme.Fonts.h1,
        fontWeight: 'bold',
        color: theme.Colors.white,
        textAlign: 'center',
        marginTop: normalize(20),
    },
    subtitle: {
        fontSize: theme.Fonts.h3,
        color: theme.Colors.textWhite,
        opacity: 0.8,
        textAlign: 'center',
        marginTop: normalize(10),
        marginBottom: normalize(40),
    },
    button: {
        backgroundColor: theme.Colors.white,
        paddingVertical: normalize(18),
        paddingHorizontal: normalize(30),
        borderRadius: normalize(30),
        width: '100%',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: theme.Colors.black,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    buttonText: {
        color: theme.Colors.primary,
        fontSize: theme.Fonts.body,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        marginTop: normalize(15),
    },
    secondaryButtonText: {
        color: theme.Colors.white,
        opacity: 0.9,
    },
});