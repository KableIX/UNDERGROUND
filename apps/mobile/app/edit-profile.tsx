import { useLocalSearchParams } from 'expo-router';
import { MemberPage } from '../src/profile/MemberPage';

export default function EditMyProfile() {
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  return <MemberPage editOnOpen fromSetup={setup === '1'} />;
}
