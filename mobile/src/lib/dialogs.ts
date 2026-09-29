/**
 * Confirm and message dialogs that work everywhere. React Native's Alert.alert does nothing on
 * web, so a button relying on it looks dead in the web preview; there the browser's own
 * confirm/alert is used instead.
 */
import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/** Resolves true only if the person chose the confirm action. */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Tapping outside the dialog (Android) counts as cancel.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function showMessage(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
