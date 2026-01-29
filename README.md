# NYCInfo Tours — Serverless Booking Platform 🗽

A full-stack, serverless web application for browsing NYC tour packages and submitting tour bookings and applications.  
Built as a **portfolio project** to demonstrate modern cloud-native architecture using AWS.

🌐 **Live Demo:**  
👉 https://www.nycinfotours.app/

---

## ✨ Features

- Responsive tour booking and application forms
- Real-time price calculation with tax
- Client-side validation (including payment input masking)
- Confirmation emails via Amazon SES
- Serverless backend with AWS Lambda + DynamoDB
- Global CDN delivery via CloudFront + custom domain from Porkbun
- HTTPS secured with AWS Certificate Manager (ACM)

> ⚠️ **Note:** This is a portfolio/demo project. No real payments are processed and no sensitive payment data is stored.

---

## 🧱 Architecture Overview

**Frontend**
- Static HTML, CSS, and Vanilla JavaScript
- Hosted on Amazon S3
- Delivered globally via Amazon CloudFront
- Custom domain managed through Porkbun

**Backend**
- AWS Lambda (Node.js)
- Amazon DynamoDB (Applications & Bookings tables)
- Amazon SES for transactional emails
- API Gateway (HTTP API)

**Security & Best Practices**
- No credit card data is stored or transmitted
- Client-side masking for sensitive fields
- Serverless IAM policies scoped per function
- HTTPS enforced via CloudFront

---

## 🛠 Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js (AWS Lambda)
- **Database:** Amazon DynamoDB
- **Email:** Amazon SES
- **Infrastructure:** AWS SAM, CloudFront, S3, ACM
- **Domain & DNS:** Porkbun

---

## 📧 Email Notifications

Users receive confirmation emails after:
- Submitting a booking
- Submitting an application

Emails include:
- Selected tour package
- Transportation option (if applicable)
- Number of guests
- Date & time
- Total price
- Contact information for changes

---

## 🚀 Local Development

```bash
sam build
sam local start-api
```
---
## Academic & Ethical Integrity

This project was created solely for **educational and portfolio purposes**.

- All code in this repository was written by the author unless explicitly stated otherwise.
- No coursework, assignments, or assessments were submitted using this project.
- No real payments are processed, and no sensitive financial data is stored or transmitted.
- Any resemblance to real businesses or services is purely coincidental.

---
