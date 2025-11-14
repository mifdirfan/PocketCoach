import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { normalize } from '../../constants/helpers';
import {Platform} from "react-native";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.Colors.primary,
                tabBarInactiveTintColor: theme.Colors.textGray,
                tabBarStyle: {
                    backgroundColor: '#EEE9FF',
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowOpacity: 0.1,
                    height: Platform.OS === 'android' ? normalize(60) : normalize(80),
                    paddingBottom: Platform.OS === 'android' ? normalize(5) : normalize(30),

                    borderTopLeftRadius: normalize(30),
                    borderTopRightRadius: normalize(30),
                    position: 'absolute'
                },
                tabBarLabelStyle: {
                    fontSize: theme.Fonts.caption,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index" // This links to app/(tabs)/index.tsx
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'chatbubble-sharp' : 'chatbubble-outline'}
                            size={normalize(26)}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="plan" // This links to app/(tabs)/plan.tsx
                options={{
                    title: 'Plan',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'document-text' : 'document-text-outline'}
                            size={normalize(26)}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile" // This links to app/(tabs)/profile.tsx
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'person-sharp' : 'person-outline'}
                            size={normalize(26)}
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}