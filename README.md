# Invoice ERP — Setup Guide

## FRONTEND

```bash
cd frontend
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # production build → dist/
```

## BACKEND (Laravel 11)

### 1. Install dependencies
```bash
cd backend
composer install
```

### 2. Configure environment
```bash
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
```
Then edit `.env` with your DB credentials and OpenAI API key.

### 3. Database setup
```bash
php artisan migrate
php artisan db:seed       # creates test user + 5 products
```

### 4. Run dev server
```bash
php artisan serve         # → http://localhost:8000
php artisan queue:work    # in a separate terminal
```

### 5. Test login credentials
- Email: `raj@rkelectronics.com`
- Password: `password123`

---

## HOSTINGER DEPLOYMENT

### Backend
1. Upload `backend/` contents to your Hostinger file manager
2. In hPanel → Hosting → Files: set document root to `/public_html/public`
3. Create MySQL database in hPanel → Databases
4. Upload `.env` with production DB credentials
5. Run via SSH:
   ```
   composer install --no-dev --optimize-autoloader
   php artisan migrate --force
   php artisan db:seed --force
   php artisan config:cache
   php artisan route:cache
   ```
6. Add cron job in hPanel:
   ```
   * * * * * php /home/username/public_html/artisan queue:work --stop-when-empty >> /dev/null 2>&1
   ```

### Frontend
Build and upload `dist/` to a subdomain (e.g., `app.yourdomain.com`) or to a folder on the same host.

Set `VITE_API_URL=https://api.yourdomain.com/api` before building.

---

## DEVELOPMENT FLOW

1. Upload a real invoice PDF via the Upload page
2. Watch the processing animation  
3. Review and edit extracted fields (check confidence scores)
4. Click Approve — all modules update automatically
5. Check Dashboard, Inventory, Sales, GST pages for updated data
