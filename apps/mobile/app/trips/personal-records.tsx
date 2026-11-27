import { ScrollView } from 'react-native';
import { RouteRecords } from '../../src/components/play/RouteRecords';
export default function PersonalRecordsScreen() {
  return <ScrollView contentContainerStyle={{padding:18}}><RouteRecords /></ScrollView>;
}
