import { AuthProvider } from './AuthContext';
import Miraje from './Miraje';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <Miraje />
    </AuthProvider>
  );
}