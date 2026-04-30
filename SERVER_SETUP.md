# 맥미니 서버 설정 가이드

## 현재 구성 (실제 적용된 방식)

```
사용자 브라우저
    ↓ HTTPS (자동, Cloudflare가 처리)
Cloudflare Edge
    ↓ 암호화 터널
cloudflared (Docker 컨테이너)
    ↓ HTTP 내부 통신
Next.js 앱 (Docker 컨테이너, app:3000)
```

- 포트포워딩 불필요
- 공인 IP 불필요
- SSL 인증서 불필요 (Cloudflare가 자동 처리)

---

## 핵심 파일 구성

| 파일 | 역할 |
|------|------|
| `Dockerfile` | Next.js 앱 멀티스테이지 빌드 |
| `docker-compose.yml` | app + cloudflared 컨테이너 실행 |
| `cloudflared-config.yml` | 터널 인그레스 규칙 (도메인 → 앱 연결) |
| `cloudflared-credentials.json` | 터널 인증 정보 (git에 올리면 안 됨) |
| `.env.local` | 환경변수 (git에 올리면 안 됨) |

---

## cloudflared-config.yml

```yaml
tunnel: 6b3d7383-3f2c-487b-9866-ef111542a743
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: lunch-picker.com
    service: http://app:3000
  - hostname: www.lunch-picker.com
    service: http://app:3000
  - service: http_status:404
```

---

## cloudflared-credentials.json

```json
{
  "AccountTag": "2b85eb0fa7f274291e9f4e7112a2362e",
  "TunnelSecret": "YTNlNGRkYWQtMmZmOS00NDkwLWE1Y2QtMWM3NzM2ZTQxNjA1",
  "TunnelID": "6b3d7383-3f2c-487b-9866-ef111542a743"
}
```

> ⚠️ 이 파일은 `.gitignore`에 등록되어 있음. git에 커밋하지 말 것.

---

## docker-compose.yml

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file:
      - .env.local
    expose:
      - "3000"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "7"

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared-config.yml:/etc/cloudflared/config.yml
      - ./cloudflared-credentials.json:/etc/cloudflared/credentials.json
    depends_on:
      - app
```

---

## Cloudflare 대시보드 설정

### DNS (dash.cloudflare.com → lunch-picker.com → DNS → Records)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `@` | `6b3d7383-3f2c-487b-9866-ef111542a743.cfargotunnel.com` | ON (주황) |
| CNAME | `www` | `6b3d7383-3f2c-487b-9866-ef111542a743.cfargotunnel.com` | ON (주황) |

### Published application routes (one.dash.cloudflare.com → Networks → Tunnels → lunch-picker-tunnel → Published application routes)

| Hostname | Service |
|----------|---------|
| `lunch-picker.com` | `http://app:3000` |

> ⚠️ Service는 반드시 `http://` 사용 (https 아님). Cloudflare가 외부 구간 SSL 처리함.

---

## 자주 쓰는 명령어

```bash
# 빌드 후 실행
docker compose up -d --build

# 재시작 (설정 변경 후)
docker compose down && docker compose up -d

# 로그 보기
docker compose logs -f app
docker compose logs -f cloudflared

# 상태 확인
docker compose ps

# 로그 파일 위치 확인
docker inspect lunch-picker-app-1 | grep LogPath
```

---

## 맥 재부팅 후 자동 실행

Docker Desktop 설정에서 **"Start Docker Desktop when you log in"** 체크.
`docker-compose.yml`에 `restart: unless-stopped`가 설정되어 있으므로 Docker가 켜지면 컨테이너가 자동으로 올라옴.

---

## 코드 업데이트 배포

```bash
git pull
docker compose up -d --build
```
