import './globals.css';
import { AuthProvider } from './contexts/AuthContext';
import Script from 'next/script';

export const metadata = {
  title: '오늘 뭐 먹지? - 점심 메뉴 투표',
  description: '팀 점심 메뉴를 투표로 정해보세요',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
