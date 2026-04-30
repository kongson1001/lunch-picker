import './globals.css';
import { AuthProvider } from './contexts/AuthContext';
import InAppBrowserGuard from './components/InAppBrowserGuard';
import InstallPromptWrapper from './components/InstallPromptWrapper';

export const metadata = {
  title: '오늘 뭐 먹지? - 점심 메뉴 투표',
  description: '팀 점심 메뉴를 투표로 정해보세요',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="뭐 먹지" />
        <meta name="theme-color" content="#e85d26" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window._installPrompt = e;
          });
        ` }} />
        <AuthProvider>
          <InAppBrowserGuard />
          <InstallPromptWrapper />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
