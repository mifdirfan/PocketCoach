import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    StyleSheet,
    Platform,
    KeyboardAvoidingView,
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    GiftedChat,
    IMessage,
    User,
    InputToolbar,
    Composer,
    Send,
    Bubble,
    InputToolbarProps
} from 'react-native-gifted-chat';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppContext } from '../../context/AppContext';
import { API_BASE_URL } from '../../constants/api';
import MacroSummary from '../../components/MacroSummary';
import { AppContextType, Summary, Profile } from '../../constants/types';
import { normalize, formatDate, formatQueryDate } from '../../constants/helpers'; // Import all helpers
import { theme } from '../../constants/theme';

// --- User/Bot Definitions ---
const BOT_USER: User = {
    _id: 2,
    name: 'PocketCoach',
    avatar: 'https://placehold.co/140x140/3a7bd5/FFFFFF?text=AI',
};
const USER_LOCAL: User = {
    _id: 1,
};

// --- Main Chat Screen ---
export default function ChatScreen() {
    const context = useContext(AppContext);

    const tabBarHeight = useBottomTabBarHeight();
    console.log(`[LOG] Tab Bar Height: ${tabBarHeight}`);
    if (Platform.OS === 'ios') {
        console.log(`[LOG] Using bottomOffset: ${tabBarHeight}`);
    } else {
        console.log(`[LOG] Using bottomOffset: 0 (for Android)`);
    }

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [displayDate, setDisplayDate] = useState(new Date());

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
    const fetchSummary = useCallback((date: Date) => {
        const dateString = formatQueryDate(date);
        fetch(`${API_BASE_URL}/get_summary?date=${dateString}`)
            .then(res => res.json())
            .then((data: Summary) => setSummary(data))
            .catch(err => console.error("Summary fetch error:", err));
    }, []);

    useEffect(() => {
        fetchSummary(displayDate);
    }, [displayDate, fetchSummary, profile]);

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
    }, [profile]); // Only run when profile is loaded

    // --- Date Handlers ---
    const handlePrevDay = () => {
        setDisplayDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setDate(newDate.getDate() - 1);
            return newDate;
        });
    };

    const handleNextDay = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentDisplayDate = new Date(displayDate);
        currentDisplayDate.setHours(0,0,0,0);
        if (currentDisplayDate < today) {
            setDisplayDate(prevDate => {
                const newDate = new Date(prevDate);
                newDate.setDate(newDate.getDate() + 1);
                return newDate;
            });
        }
    };
    const isToday = displayDate.toDateString() === new Date().toDateString();

    // --- Send Handler ---
    const onSend = useCallback((newMessages: IMessage[] = []) => {
        const userMessage = newMessages[0];

        if (!isToday && (userMessage.text.includes('g') || userMessage.text.includes('그램') || userMessage.text.includes('update'))) {
            Alert.alert("알림", "식사 기록 및 프로필 업데이트는 오늘 날짜에만 가능합니다.");
            return;
        }

        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
        setIsTyping(true);

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
                    createdAt: Date.now(),
                    user: BOT_USER,
                };
                setMessages(previousMessages => GiftedChat.append(previousMessages, [botResponse]));

                if (data.profile) {
                    setProfile(data.profile as Profile);
                }
                if (data.daily_summary) {
                    fetchSummary(new Date());
                }
            })
            .catch(err => {
                console.error(err);
                setIsTyping(false);
                const errorResponse: IMessage = {
                    _id: uuidv4(),
                    text: "서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.",
                    createdAt: Date.now(),
                    user: BOT_USER,
                };
                setMessages(previousMessages => GiftedChat.append(previousMessages, [errorResponse]));
            });
    }, [isToday, fetchSummary, setProfile]);

    // --- Custom Render Functions for Gifted Chat ---
    const renderCustomInputToolbar = (props: InputToolbarProps<IMessage>) => (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
            primaryStyle={{ alignItems: 'center' }}
        />
    );

    const renderCustomComposer = (props: any) => (
        <Composer
            {...props}
            textInputStyle={styles.textInput}
            placeholderTextColor={theme.Colors.textPlaceholder}
        />
    );

    const renderCustomSend = (props: any) => (
        <Send
            {...props}
            containerStyle={styles.sendContainer}
            disabled={!props.text}
        >
            <Ionicons name="send" size={normalize(24)} color={theme.Colors.primary} />
        </Send>
    );

    const renderCustomBubble = (props: any) => (
        <Bubble
            {...props}
            wrapperStyle={{
                left: styles.botBubble,
                right: styles.userBubble,
            }}
            textStyle={{
                left: styles.botBubbleText,
                right: styles.userBubbleText,
            }}
        />
    );

    return (
        <LinearGradient colors={[theme.Colors.gradientStart, theme.Colors.gradientEnd]} style={styles.gradientBackground}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatHeaderTitle}>Chat</Text>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-horizontal" size={theme.Fonts.h1} color={theme.Colors.textWhite} />
                    </TouchableOpacity>
                </View>

                <View style={styles.datePickerContainer}>
                    <TouchableOpacity onPress={handlePrevDay}>
                        <Ionicons name="chevron-back" size={normalize(24)} color={theme.Colors.textWhite} />
                    </TouchableOpacity>
                    <Text style={styles.datePickerText}>{isToday ? 'Today' : formatDate(displayDate)}</Text>
                    <TouchableOpacity onPress={handleNextDay} disabled={isToday}>
                        <Ionicons name="chevron-forward" size={normalize(24)} color={isToday ? '#ffffff50' : theme.Colors.textWhite} />
                    </TouchableOpacity>
                </View>

                <MacroSummary summary={summary} />

                <View style={styles.chatArea}>
                    <GiftedChat
                        messages={messages}
                        onSend={newMessages => onSend(newMessages)}
                        user={USER_LOCAL}
                        isTyping={isTyping}
                        placeholder="Log a meal or ask a question..."
                        renderUsernameOnMessage={true}
                        renderInputToolbar={renderCustomInputToolbar}
                        renderComposer={renderCustomComposer}
                        renderSend={renderCustomSend}
                        renderBubble={renderCustomBubble}
                        minInputToolbarHeight={normalize(50)}

                        //bottomOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
                    />
                </View>

                {/* KeyboardAvoidingView is handled by GiftedChat's props, but we keep one for Android just in case */}
                {/*{Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}*/}
            </SafeAreaView>
        </LinearGradient>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    gradientBackground: {
        flex: 1,
    },
    container: {
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
    datePickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.Spacing.padding,
        paddingVertical: normalize(10),
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    datePickerText: {
        fontSize: theme.Fonts.body,
        fontWeight: '500',
        color: theme.Colors.textWhite,
    },
    chatArea: {
        flex: 1,
        backgroundColor: theme.Colors.backgroundChat,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
        marginTop: normalize(10),
        overflow: 'hidden',
    },
    // Gifted Chat Styles
    userBubble: {
        backgroundColor: theme.Colors.primary,
        borderBottomRightRadius: normalize(5),
        borderBottomLeftRadius: theme.Spacing.radius,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
    },
    botBubble: {
        backgroundColor: theme.Colors.white,
        borderBottomLeftRadius: normalize(5),
        borderBottomRightRadius: theme.Spacing.radius,
        borderTopLeftRadius: theme.Spacing.radius,
        borderTopRightRadius: theme.Spacing.radius,
    },
    userBubbleText: {
        color: theme.Colors.white,
        fontSize: theme.Fonts.body,
    },
    botBubbleText: {
        color: theme.Colors.textBlack,
        fontSize: theme.Fonts.body,
    },
    inputToolbar: {
        backgroundColor: theme.Colors.white,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingHorizontal: normalize(10),
        paddingVertical: normalize(5),
    },
    textInput: {
        color: theme.Colors.textBlack,
        fontSize: theme.Fonts.body,
        lineHeight: normalize(20),
        paddingTop: Platform.OS === 'ios' ? normalize(8) : 0, // iOS padding fix
        paddingBottom: Platform.OS === 'ios' ? normalize(8) : 0, // iOS padding fix
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: normalize(10),
        marginRight: normalize(5),
        marginBottom: Platform.OS === 'ios' ? normalize(5) : normalize(8), // OS-specific alignment
    }
});