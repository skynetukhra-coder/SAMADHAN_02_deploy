# SAMADHAN Portal — Deployment Guide

This project is fully compiled and deployment-ready. It can be deployed using either **Docker**, **Node.js process manager (PM2 / systemd)**, or **Cloud Hosting (Render / Railway / AWS / VPS)**.

---

## 1. Quick Start (Production Node.js)

### Prerequisites
- Node.js (v18 or v20+ recommended)
- MySQL (v8.0+) with database initialized using `u578256029_samadhan (2).sql`

### Build & Run
From the project root:

```bash
# 1. Install dependencies
npm run install:all

# 2. Compile frontend into production distribution
npm run build

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your production database credentials and JWT_SECRET

# 4. Start the production server
npm start
```

The server will start on the port configured in `.env` (default: `5000` or `5001`), serving both the backend REST APIs and the optimized static frontend bundle.

---

## 2. Docker Deployment (Recommended for Cloud / VPS)

A multi-stage `Dockerfile` and `docker-compose.yml` are included.

### Start Everything (App + MySQL):
```bash
docker compose up -d --build
```

- **Application URL**: `http://localhost:5000`
- **MySQL Container**: Automatically imports `u578256029_samadhan (2).sql` on first startup.

### Stop Containers:
```bash
docker compose down
```

---

## 3. Production Process Manager (PM2)

For Linux VPS / Ubuntu / Debian:

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
npm run build

# Start backend with PM2
cd backend
pm2 start server.js --name "samadhan-portal"

# Enable startup on server reboot
pm2 startup
pm2 save
```

---

## 4. Environment Variables Reference

Configure these in `backend/.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `5000` |
| `DB_HOST` | MySQL database host | `localhost` or RDS endpoint |
| `DB_PORT` | MySQL database port | `3306` |
| `DB_USER` | MySQL database username | `root` |
| `DB_PASSWORD` | MySQL database password | `your_secure_password` |
| `DB_NAME` | Database name | `samadhan_db` |
| `JWT_SECRET` | Secret key for JWT auth | Long random string |

---

## 5. Nginx Reverse Proxy Configuration (Optional)

If running behind an Nginx reverse proxy with SSL/TLS (HTTPS):

```nginx
server {
    listen 80;
    server_name yourdomain.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.gov.in;

    ssl_certificate /etc/letsencrypt/live/yourdomain.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.gov.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
