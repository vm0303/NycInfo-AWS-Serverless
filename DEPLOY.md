# NYCInfo Tours – AWS Serverless Deploy (Free Tier-friendly)

## 0) Prereqs
- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed
- Node 20+

## 1) SES (email sending)
Region recommendation: **us-east-1**.

1. In SES → Verified identities → Create identity → **Domain**
   - Domain: `nycinfotours.app`
2. Add the DKIM/SPF records SES shows into Porkbun DNS.
3. While in SES **sandbox**, verify your Gmail as a recipient for testing.

Set the sender in `backend/template.yaml`:
- `SES_FROM_EMAIL: no-reply@nycinfotours.app`

## 2) Deploy backend (SAM)
```bash
cd backend
npm install
sam build
sam deploy --guided
```

Copy the `ApiUrl` output.

## 3) Configure frontend
Edit `js/config.js` and set:

```js
window._config.api.invokeUrl = "https://<YOUR_API_ID>.execute-api.<REGION>.amazonaws.com";
```

## 4) Host frontend
- Create S3 bucket (private)
- Put files into it
- CloudFront distribution with S3 origin (OAC recommended)

## 5) Metrics
- CloudWatch: Lambda & API metrics automatically
- CloudFront: enable standard metrics; optionally enable access logs to S3
