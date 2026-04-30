'use client';
import { useAuth } from '../contexts/AuthContext';
import InstallPrompt from './InstallPrompt';

export default function InstallPromptWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <InstallPrompt loggedIn={!!user} />;
}
