import { useLocalSearchParams } from 'expo-router';
import { MemberPage } from '../../src/profile/MemberPage';

export default function MemberRoute() {
  const {id}=useLocalSearchParams<{id:string}>();
  return <MemberPage target={typeof id==='string'?id:''}/>;
}
