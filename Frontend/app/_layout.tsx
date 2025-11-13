import React, { useContext } from 'react';
import { Stack } from 'expo-router';
// --- FIX: Use relative path ---
import { AppProvider, AppContext, AppContextTypeWithLoading } from '../context/AppContext';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

// This component now just waits for fonts and profile to be loaded
function RootLayoutNav() {
    const context = useContext(AppContext) as AppContextTypeWithLoading;

    // Show a loader while we're restoring the profile
    if (context?.isRestoring) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // The old useEffect with router.replace() is REMOVED.
    // The 'index' route (our welcome screen) will now load by default.

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}

// Your RootLayout is the same, just wrapping RootLayoutNav
export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        ...Ionicons.font,
    });

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AppProvider>
            <RootLayoutNav />
        </AppProvider>
    );
}