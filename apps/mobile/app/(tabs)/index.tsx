import { StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

export default function NewswireScreen() {
  return (
    <Screen>
      <Text variant="brand" gold>
        UNDERGROUND
      </Text>
      <Text variant="caption" style={styles.tagline}>
        OWNERSHIP IS THE ENTRY.
      </Text>
      <GoldRule />
      <Text variant="title">Newswire</Text>
      <Text style={styles.body}>
        Verified captures and clout will surface here. Feed wiring lands after the run pipeline
        accepts production evidence.
      </Text>
      <View style={styles.placeholder}>
        <Text variant="caption" gold>
          NO STORIES YET
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
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
