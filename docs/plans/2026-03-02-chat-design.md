# 채팅 기능 설계

## 요구사항
- 방 안에서 실시간 채팅
- 메시지는 방 삭제 시 함께 삭제 (별도 보존 불필요)
- 자신이 보낸 메시지 삭제 가능
- 채팅창 위치: 투표/검색 섹션 아래 풀 너비

## 데이터 구조

```
rooms/{roomId}/messages/{pushId}
├── uid: string
├── nickname: string
├── profileImage: string | null
├── text: string
└── createdAt: number
```

## 컴포넌트

### `src/components/Chat.jsx` (신규)
- props: `roomId`, `user`
- `rooms/{roomId}/messages` 실시간 구독
- 내 메시지 오른쪽, 상대 메시지 왼쪽 말풍선
- 내 메시지에만 삭제 버튼
- 새 메시지 자동 스크롤
- Enter 전송 지원

### `src/pages/Room.jsx` (수정)
- 2컬럼 아래에 `<Chat roomId={roomId} user={user} />` 풀 너비 배치

## 레이아웃

```
+-------투표-------+-------검색-------+
|                  |                  |
+------------------+------------------+
|              채팅 (풀 너비)           |
|  [상대] 안녕하세요           [나] 반가워요 |
|  [ 입력창...              ] [전송]    |
+--------------------------------------+
```

## Firebase 비용
- Spark 무료 플랜 기준 충분 (저장 1GB / 전송 10GB/월 / 동시접속 100)
