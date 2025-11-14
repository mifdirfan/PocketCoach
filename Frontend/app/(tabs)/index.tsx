import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    StyleSheet,
    Platform,
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    FlatList,
    TextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'; // No longer needed

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppContext } from '../../context/AppContext';
import { API_BASE_URL } from '../../constants/api';
import MacroSummary from '../../components/MacroSummary';
import { AppContextType, Summary, Profile, IMessage, User } from '../../constants/types';
import { normalize, formatDate, formatQueryDate } from '../../constants/helpers';
import { theme } from '../../constants/theme';

// --- User/Bot Definitions (Unchanged) ---
const BOT_USER: User = {
    _id: 2,
    name: 'PocketCoach',
    avatar: '../../assets/favicon.png',
};
const USER_LOCAL: User = {
    _id: 1,
};

const MessageBubble = ({ item }: { item: IMessage }) => {
    const isBot = item.user._id === BOT_USER._id;

    return (
        <View style={[
            styles.bubbleContainer,
            isBot ? styles.botBubbleContainer : styles.userBubbleContainer
        ]}>
            <View style={[
                isBot ? styles.botBubble : styles.userBubble
            ]}>
                <Text style={isBot ? styles.botBubbleText : styles.userBubbleText}>
                    {item.text}
                </Text>
            </View>
        </View>
    );
};

// --- Main Chat Screen ---
export default function ChatScreen() {
    const context = useContext(AppContext);

    const tabBarHeight = useBottomTabBarHeight(); // This is the FULL height (e.g., 84)
    const insets = useSafeAreaInsets();      // This gets the bottom notch height (e.g., 34)

    // The KAV offset is the height of the tab bar *minus* the bottom safe area.
    // This stops the "double padding" gap.
    // e.g., 84 (tabBarHeight) - 34 (insets.bottom) = 50 (the visible tab bar)
    const kavOffset = Platform.OS === 'ios' ? (tabBarHeight - insets.bottom) : 0;

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [currentMessageText, setCurrentMessageText] = useState("");
    // const [displayDate, setDisplayDate] = useState(new Date()); // <-- REMOVED

    // Show loader if context is not ready
    if (!context) {
        return (
            <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.Colors.white} />
            </LinearGradient>
        );
    }
    const { profile, setProfile } = context;

    // --- Data Fetching ---
    // This function now *only* fetches for the date it's given
    const fetchSummary = useCallback((date: Date) => {
        const dateString = formatQueryDate(date);
        fetch(`${API_BASE_URL}/get_summary?date=${dateString}`)
            .then(res => res.json())
            .then((data: Summary) => setSummary(data))
            .catch(err => console.error("Summary fetch error:", err));
    }, []);

    // Fetch summary for TODAY on load
    useEffect(() => {
        fetchSummary(new Date());
    }, [fetchSummary, profile]); // <-- REMOVED displayDate

    // --- Welcome Message (Unchanged) ---
    useEffect(() => {
        if (profile) {
            setMessages([
                {
                    _id: uuidv4(),
                    text: `안녕하세요, ${profile?.name || '사용자'}님! '${profile?.goal || '목표'}' 달성을 도울 준비가 되었습니다.`,
                    createdAt: Date.now(),
                    user: BOT_USER,
                },
            ]);
        }
    }, [profile]);

    // --- Send Handler (SIMPLIFIED) ---
    const onSendBackend = useCallback((newMessages: IMessage[] = []) => {
        const userMessage = newMessages[0];

        // --- Date check is REMOVED ---
        // We assume all logs/updates are for today

        setMessages(previousMessages => [userMessage, ...previousMessages]);
        setIsTyping(true);
        setCurrentMessageText("");

        fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage.text }),
        })
            .then(res => res.json())
            .then(data => {
                setIsTyping(false);
                const botResponse: IMessage = {
                    _id: uuidv4(),
                    text: data.response,
                    createdAt: new Date(),
                    user: BOT_USER,
                };
                setMessages(previousMessages => [botResponse, ...previousMessages]);

                if (data.profile) {
                    setProfile(data.profile as Profile);
                }
                if (data.daily_summary) {
                    fetchSummary(new Date());
                }
            })
            .catch(err => {
                // ... (error handling unchanged) ...
                console.error(err);
                setIsTyping(false);
                const errorResponse: IMessage = {
                    _id: uuidv4(),
                    text: "서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.",
                    createdAt: new Date(),
                    user: BOT_USER,
                };
                setMessages(previousMessages => [errorResponse, ...previousMessages]);
            });
    }, [fetchSummary, setProfile]);

    const handleSend = () => {
        const text = currentMessageText.trim();
        if (!text) {
            return;
        }

        // 1. Create the IMessage object
        const userMessage: IMessage = {
            _id: uuidv4(),
            text: text,
            createdAt: new Date(),
            user: USER_LOCAL,
        };

        // 2. Call our backend logic
        onSendBackend([userMessage]);
    };


    return (
        <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.gradientBackground}>

            {/* 1. SafeArea for the TOP notch ONLY */}
            <SafeAreaView style={styles.topSafe} edges={['top']}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatHeaderTitle}>Chat</Text>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-horizontal" size={theme.Fonts.h1} color={theme.Colors.textWhite} />
                    </TouchableOpacity>
                </View>
                <MacroSummary summary={summary} />
            </SafeAreaView>

            {/* 2. KeyboardAvoidingView wraps ONLY the chat */}
            {/* It handles BOTH the keyboard and the bottom tab bar */}
            <KeyboardAvoidingView
                style={styles.chatContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={kavOffset} // <-- This is the KEY
            >
                {/* 3. The Message List */}
                <FlatList
                    data={messages}
                    renderItem={({ item }) => <MessageBubble item={item} />}
                    keyExtractor={(item) => item._id.toString()}
                    inverted // <-- This makes it a chat (bottom-up)
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                />

                {/* 4. The Input Bar (reusing your old styles) */}
                <View style={styles.inputToolbar}>
                    <TextInput
                        style={styles.textInput}
                        value={currentMessageText}
                        onChangeText={setCurrentMessageText}
                        placeholder="Log a meal or ask a question..."
                        placeholderTextColor={theme.Colors.textPlaceholder}
                        multiline
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        style={styles.sendContainer}
                        disabled={!currentMessageText.trim()}
                    >
                        <Ionicons
                            name="send"
                            size={normalize(24)}
                            color={!currentMessageText.trim() ? theme.Colors.textPlaceholder : theme.Colors.primary}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

// --- Styles (Unchanged, but datePickerContainer is no longer used) ---
const styles = StyleSheet.create({
    gradientBackground: {
        flex: 1,
    },
    topSafe: {
        // This view only holds the header and summary
    },
    container: { // No longer used on SafeAreaView
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.Spacing.padding,
        paddingTop: Platform.OS === 'android' ? theme.Spacing.margin : 0,
        paddingBottom: normalize(10),
    },
    chatHeaderTitle: {
        fontSize: theme.Fonts.h1,
        fontWeight: 'bold',
        color: theme.Colors.textWhite,
    },
    chatContainer: { // This is the KAV style
        flex: 1,
        backgroundColor: theme.Colors.backgroundChat,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
        marginTop: normalize(10),
        overflow: 'hidden',
    },
    kavContainer: { // This is the KAV
        flex: 1,
    },
    messageList: {
        flex: 1,
    },
    messageListContent: {
        padding: normalize(10),
    },
    bubbleContainer: {
        flexDirection: 'row',
        marginVertical: normalize(5),
    },
    userBubbleContainer: {
        justifyContent: 'flex-end',
    },
    botBubbleContainer: {
        justifyContent: 'flex-start',
    },
    userBubble: {
        backgroundColor: theme.Colors.primary,
        borderBottomRightRadius: normalize(5),
        borderBottomLeftRadius: theme.Spacing.radius,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
        padding: normalize(10),
        maxWidth: '80%',
    },
    botBubble: {
        backgroundColor: theme.Colors.white,
        borderBottomLeftRadius: normalize(5),
        borderBottomRightRadius: theme.Spacing.radius,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
        padding: normalize(10),
        maxWidth: '80%',
    },
    userBubbleText: {
        color: theme.Colors.white,
        fontSize: theme.Fonts.body,
    },
    botBubbleText: {
        color: theme.Colors.textBlack,
        fontSize: theme.Fonts.body,
    },
    // --- 4. FIXES FOR INPUT BAR ALIGNMENT ---
    inputToolbar: {
        flexDirection: 'row',
        alignItems: 'flex-end', // <-- THIS ALIGNS ITEMS TO THE BOTTOM
        backgroundColor: theme.Colors.white,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingHorizontal: normalize(10),
        paddingVertical: normalize(5), // Outer padding
        //minHeight: normalize(50),
    },
    textInput: {
        flex: 1,
        color: theme.Colors.textBlack,
        fontSize: theme.Fonts.body,
        lineHeight: normalize(20),
        paddingTop: normalize(8),    // Consistent padding
        paddingBottom: normalize(8), // Consistent padding
        maxHeight: 100, // This is fine
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: normalize(10),
        marginRight: normalize(5),
        // This padding aligns the button with the text input's bottom line
        paddingBottom: normalize(8),
    }
});