import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { AppContextType, Profile } from '../constants/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_STORAGE_KEY = 'userProfile';

// 1. Update the context type to include the new loading state
export interface AppContextTypeWithLoading extends AppContextType {
    isRestoring: boolean;
}

// 2. Create the context with null default
export const AppContext = createContext<AppContextTypeWithLoading | null>(null);

// 3. Create the Provider
export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isRestoring, setIsRestoring] = useState(true); // Our new loading state

    // --- NEW: Load profile from storage on app start ---
    useEffect(() => {
        const restoreProfile = async () => {
            try {
                const storedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
                if (storedProfile) {
                    setProfile(JSON.parse(storedProfile));
                }
            } catch (e) {
                console.error("Failed to restore profile", e);
            } finally {
                // We're done trying to load, even if it failed
                setIsRestoring(false);
            }
        };

        restoreProfile();
    }, []);

    // --- NEW: Custom setter function to save on change ---
    const handleSetProfile = async (newProfile: Profile | null) => {
        try {
            if (newProfile) {
                // Save to storage
                await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
            } else {
                // If profile is null (e.g., user logs out), remove it
                await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
            }
        } catch (e) {
            console.error("Failed to save profile", e);
        }
        // Finally, update the state in memory
        setProfile(newProfile);
    };

    return (
        <AppContext.Provider
            value={{
                profile,
                setProfile: handleSetProfile, // Use our new setter function
                isRestoring // Pass the loading state
            }}
        >
            {children}
        </AppContext.Provider>
    );
};