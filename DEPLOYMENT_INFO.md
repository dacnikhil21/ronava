# RONAV Platform — Live Server & Deployment Guide

## 🌐 Live Production Server Details
- **Live URL**: http://13.201.4.145
- **Public IP**: `13.201.4.145`
- **AWS Instance ID**: `i-0157cf2449281e925 (RONAV-Production-Server)`
- **Server OS & User**: Ubuntu Linux (`ubuntu@ip-172-31-15-19`)
- **Server Path**: `/var/www/ronava`
- **Process Manager**: PM2 (`ronav-api` - Process ID 0)
- **Web Server**: Nginx reverse proxy on port 80 -> Node.js on port 3000

---

## 🐙 GitHub & Git Credentials
- **Repository**: `https://github.com/dacnikhil21/ronava.git`
- **Default Branch**: `main`
- **Active GitHub Account**: `neelhari` (`dacnikhil21@gmail.com`)
- **Removed Accounts**: `dsrithaja` (permanently cleared from Windows Credential Manager)

---

## 🚀 How to Deploy Changes (1-Click)

From your local project folder (`c:\Users\dache\Desktop\ronava`), run:

```bash
npm run deploy
```

This runs:
1. `git push origin main` (using your saved `neelhari` account, zero popups)
2. `node deploy_to_ec2.mjs` (sends a webhook to `http://13.201.4.145/api/system/webhook-deploy` to auto-pull, build, and restart PM2).

---

## 🛠 Manual Server Fallback (If ever needed)
If you ever SSH or open the AWS EC2 terminal directly:

```bash
cd /var/www/ronava
git pull origin main
npm run build
pm2 restart all
```

---

## 🔑 Administrative Details
- **Super Admin ID**: `ADM001`
- **Admin Password**: `Ronav@123` (or `admin`)
- **Support Hotline**: `9966203053`
- **Official Email**: `rosenavaneethamenterprises@gmail.com`
