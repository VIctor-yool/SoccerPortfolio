# 환경 변수 설정 가이드

## 로컬 개발 환경

1. `soccer_system` 폴더에 `.env` 파일 생성
2. 아래 내용을 복사하여 필요한 값 입력

```env
# Server
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3001

# Database
DATABASE_URL=postgresql://username:password@host:port/database
# 또는
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=your_password
# DB_DATABASE=soccer_db

# JWT (개발용 - 프로덕션에서는 강력한 랜덤 문자열 사용)
JWT_SECRET=dev-secret-key-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-key
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Render 배포 환경

Render 대시보드에서 다음 환경 변수들을 설정하세요:

### 필수 변수

```
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-frontend-domain.com
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=<강력한 랜덤 문자열 - 최소 32자>
JWT_REFRESH_SECRET=<JWT_SECRET과 다른 강력한 랜덤 문자열>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### JWT_SECRET 생성 방법

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

자세한 배포 가이드는 `RENDER_DEPLOYMENT.md`를 참고하세요.

