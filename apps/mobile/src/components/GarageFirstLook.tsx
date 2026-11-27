import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { shell } from '../theme/shell';
export function EditGarageProfile() {
  const router = useRouter();
  return <Pressable accessibilityRole="button" style={styles.inline} onPress={()=>router.push('/edit-profile')}>
    <Text style={styles.gold}>Edit profile</Text>
  </Pressable>;
}
export function GarageStoreLink() {
  const router = useRouter();
  return <Pressable accessibilityRole="button" style={styles.inline} onPress={()=>router.push('/garage-upgrades')}>
    <Text style={styles.gold}>Garage Upgrade Store</Text>
  </Pressable>;
}
const styles=StyleSheet.create({inline:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},gold:{color:shell.accent,fontFamily:'Inter_600SemiBold'}});
