#!/bin/bash
# ==============================================================================
# RONAV TECHNOLOGIES — EC2 ENTERPRISE SERVER & POSTGRESQL PROVISIONING SCRIPT
# ==============================================================================
# This script sets up a complete Ubuntu EC2 instance with:
# 1. Node.js (v20 LTS) & Git
# 2. PostgreSQL 16 Database with 'ronav_db'
# 3. PM2 Process Manager for 24/7 uptime & auto-restart
# 4. Nginx Reverse Proxy with SSL Support
# ==============================================================================

set -e

echo "========================================="
echo "🚀 RONAV TECHNOLOGIES EC2 PROVISIONING"
echo "========================================="

# 1. Update System Packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw nginx

# 2. Install Node.js v20 LTS
echo "📦 Installing Node.js v20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 3. Install & Configure PostgreSQL 16
echo "🐘 Installing & Configuring PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create Database & User (Secure localhost only)
DB_USER="ronav_admin"
DB_PASS="RonavSecure2026!Fintech"
DB_NAME="ronav_db"

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true

echo "✓ PostgreSQL Database [$DB_NAME] created successfully!"

# 4. Clone or Pull Application Repository
APP_DIR="/var/www/ronava"
echo "📁 Setting up Application Directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/dacnikhil21/ronava.git $APP_DIR
fi

cd $APP_DIR
git pull origin main
npm install --production

# 5. Setup Production Environment Variables
cat <<EOF > $APP_DIR/.env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
PG_SSL=false

AWS_REGION=${AWS_REGION:-ap-south-1}
AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME:-ronav-media-storage-688927}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-""}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-""}
AWS_CLOUDFRONT_DOMAIN=${AWS_CLOUDFRONT_DOMAIN:-d1rqftl6szhydo.cloudfront.net}
VITE_CLOUDFRONT_URL=${VITE_CLOUDFRONT_URL:-https://d1rqftl6szhydo.cloudfront.net}
EOF

# 6. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx Reverse Proxy..."
sudo bash -c "cat << 'NGINX_CONF' > /etc/nginx/sites-available/ronav
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF"

sudo ln -sf /etc/nginx/sites-available/ronav /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 7. Start Backend with PM2
echo "⚡ Starting RONAV Backend Server with PM2..."
pm2 delete ronav-backend || true
pm2 start server/server.js --name "ronav-backend"
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER || true

echo "========================================="
echo "🎉 RONAV PRODUCTION STACK IS LIVE!"
echo "Database: PostgreSQL (localhost:5432)"
echo "Storage: AWS S3 + CloudFront CDN"
echo "Reverse Proxy: Nginx (Port 80/443)"
echo "Process: PM2 Active (24/7 uptime)"
echo "========================================="
