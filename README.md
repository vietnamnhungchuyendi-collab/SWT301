# SWT301 — CI Maven: Exercise 1 và Exercise 2

[![MathUtil CI](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/maven.yml/badge.svg?branch=codex%2Fmaven-ci-exercises-1-2)](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/maven.yml?query=branch%3Acodex%2Fmaven-ci-exercises-1-2)
[![Sales Management CI](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/sales-ci.yml/badge.svg?branch=codex%2Fmaven-ci-exercises-1-2)](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/sales-ci.yml?query=branch%3Acodex%2Fmaven-ci-exercises-1-2)

Phạm vi bài nộp: Exercise 1 MathUtil và Exercise 2 Sales Management trong đề CI Maven. Không có Exercise 3, Jest hoặc Report5 trong gói CI này. Nhánh riêng: `codex/maven-ci-exercises-1-2`. Repository gốc vẫn chứa ứng dụng FJMS; đó không phải nội dung bài CI Java này.


Chi tiết cài đặt và nộp bài: [README_CI_EX1_EX2.md](README_CI_EX1_EX2.md).

---

[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/nXoHondQ)

# Freelancer Job Matching System (FJMS)

## Project Overview
Freelancer Job Matching System (FJMS) is a modern freelance marketplace platform that connects Employers and Freelancers for online digital projects and remote services.

The system supports separate workflows for Guests, Freelancers, Employers, and Admins.

The platform also includes:
- VNPay escrow payment
- Wallet & transaction management
- Email verification
- Messages system
- AI Chat Support
- Reports & disputes handling
- Analytics dashboard
- Admin moderation

---

# Technology Stack

## Frontend
- ReactJS
- Vite
- TailwindCSS
- React Router DOM
- Recharts
- Lucide React Icons

## Backend
- Node.js
- Express.js

## Database
- SQL Server

## Authentication
- JWT Authentication
- bcrypt password hashing

---

# User Roles

## 1. Guest
Guest users can:
- View Public Projects
- View Public Freelancer Profiles
- Register
- Verify Email
- Log In
- Forgot Password

---

## 2. Freelancer
Freelancers can:
- Search Projects
- View Project Details
- Submit Proposal
- Edit Proposals
- Submit Finished Work
- Edit Skills & Portfolio
- Edit Profile
- View Wallet & Transactions
- Add Bank Account
- Messages
- Report Violation
- AI Chat Support
- Switch Role

---

## 3. Employer
Employers can:
- Create Project
- Edit Posted Projects
- Delete Posted Projects
- Review Proposals
- Select Freelancer
- Make Payment via VNPay
- Confirm Project Completion
- Request Revision
- Rate & Review Freelancer
- Messages
- View Wallet & Transactions

---

## Product Categories
- Web Development
- Mobile Development
- UI/UX Design
- Graphic Design
- Video Editing
- Content Writing
- Translation
- SEO & Marketing
- Virtual Assistant
- Data Entry
- AI Services

---

# Frontend Structure
# Project Structure

```text
frontend/
  assets/
  components/
  layouts/
  pages/
  public/
  App.jsx
  main.jsx
  index.css

backend/
  config/
  controllers/
  middleware/
  routes/
  utils/
  server.js
```
---

# Main Routes

```text
/
/login
/register
/verify-email
/forgot-password
/freelancer/dashboard
/employer/dashboard
/admin/dashboard
/projects
/projects/:id
/freelancers/:id
/workspace/:projectId
/wallet
/messages
/reports
/disputes
```

---

# UI Design Style

## Design Style
- Modern SaaS marketplace
- Professional startup design
- Clean and responsive
- Premium dashboard layout
- Elegant spacing and typography

## Design Inspiration
- Upwork
- Stripe
- Vercel
- Linear
- Notion

---

# Color Palette

| Element | Color |
|---|---|
| Primary Emerald | #0F766E |
| Dark Emerald | #115E59 |
| Gold Accent | #D4A017 |
| Background | #F8FAFC |
| White Card | #FFFFFF |
| Main Text | #111827 |
| Muted Text | #6B7280 |
| Border | #E5E7EB |

---

# Coding Rules

- Use English for all source code.
- Use reusable React components.
- Follow clean folder structure.
- Use responsive design.
- Keep UI professional and modern.

---

# Current Development Phase

Current Progress:
- UI/UX Design
- Use Case Design
- Database Design
- Authentication Planning
- Frontend Development

---

## 🚀 Hướng Dẫn Chạy Dự Án

### Yêu cầu
- [Node.js LTS](https://nodejs.org) — `node -v` để kiểm tra
- [SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) + import file `FJMS_Database.sql`

### Chạy dự án (từ thư mục gốc)

```bash
npm install
npm run dev
```

- 🌐 Frontend: http://localhost:5173
- ⚙️ Backend: http://localhost:5000
