import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, MacroSet } from './types'; // Make sure types.ts is in this folder

// --- 1. Define Storage Keys ---
const PROFILE_STORAGE_KEY = 'userProfile';
const LOGS_STORAGE_KEY = 'mealLogs';

// --- 2. PROFILE FUNCTIONS (Using AsyncStorage from your code) ---
export const saveProfileLocally = async (profile: Profile) => {
    try {
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
        console.log('✅ Profile saved to phone storage.');
    } catch (e) {
        console.error('Error saving profile:', e);
    }
};

export const loadProfileLocally = async (): Promise<Profile | null> => {
    try {
        const storedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (storedProfile) {
            console.log('[Storage] Profile loaded from phone.');
            return JSON.parse(storedProfile);
        }
        console.log('[Storage] No profile file found.');
        return null;
    } catch (e) {
        console.error('Error loading profile:', e);
        return null;
    }
};

// --- 3. MEAL LOG FUNCTIONS (Using AsyncStorage) ---
// Structure: { "2025-10-12": [ {meal1}, {meal2} ] }
export const saveLogLocally = async (date: string, meal: any) => {
    try {
        // 1. Load existing logs
        let logs: { [key: string]: any[] } = {};
        const content = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
        if (content) {
            logs = JSON.parse(content);
        }

        // 2. Add new meal
        if (!logs[date]) logs[date] = [];
        logs[date].push(meal);

        // 3. Save back
        await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
        console.log('✅ Meal logged to phone storage.');
        return logs;
    } catch (e) {
        console.error('Error saving log:', e);
        return {};
    }
};

export const loadDailyLog = async (date: string): Promise<any[]> => {
    try {
        const content = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
        if (!content) return [];

        const logs = JSON.parse(content);
        return logs[date] || [];
    } catch (e) {
        return [];
    }
};