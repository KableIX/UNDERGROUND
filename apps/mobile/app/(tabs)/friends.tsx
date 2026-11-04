import { StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

export default function FriendsScreen() {
  return (
    <Screen>
      <Text variant="title" gold>
        Friends
      </Text>
      <Text variant="caption" style={styles.meta}>
        REQUEST · ACCEPT · REMOVE
      </Text>
      <GoldRule />
      <Text style={styles.body}>
        Friendship graph schemas and RLS land with founder provisioning. This screen will list
        pending requests and accepted friends.
      </Text>
      <View style={styles.placeholder}>
        <Text variant="caption" gold>
          NO CONNECTIONS YET
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  body: {
    color: shell.muted,
  },
  placeholder: {
    marginTop: 32,
    paddingVertical: 48,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
});
