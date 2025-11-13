import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
// --- FIX: Use relative paths for component files ---
import { theme } from '../constants/theme';
import { normalize } from '../constants/helpers';

interface AlertModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
                                                          visible,
                                                          title,
                                                          message,
                                                          confirmText = 'Delete',
                                                          cancelText = 'Cancel',
                                                          onConfirm,
                                                          onCancel,
                                                      }) => {
    return (
        <Modal
            transparent={true}
            animationType="fade"
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.modalMessage}>{message}</Text>
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                        >
                            <Text style={[styles.buttonText, styles.cancelButtonText]}>{cancelText}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        maxWidth: 300,
        backgroundColor: theme.Colors.cardBackground,
        borderRadius: theme.Spacing.radius,
        padding: theme.Spacing.padding,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: theme.Colors.black,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    modalTitle: {
        fontSize: theme.Fonts.h3,
        fontWeight: 'bold',
        color: theme.Colors.textBlack,
        marginBottom: normalize(10),
    },
    modalMessage: {
        fontSize: theme.Fonts.body,
        color: theme.Colors.textGray,
        textAlign: 'center',
        marginBottom: normalize(20),
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    button: {
        flex: 1,
        paddingVertical: normalize(12),
        borderRadius: normalize(10),
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: theme.Colors.backgroundChat,
        marginRight: normalize(5),
    },
    cancelButtonText: {
        color: theme.Colors.textBlack,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: theme.Colors.error,
        marginLeft: normalize(5),
    },
    confirmButtonText: {
        color: theme.Colors.white,
        fontWeight: 'bold',
    },
    buttonText: {
        fontSize: theme.Fonts.body,
    },
});