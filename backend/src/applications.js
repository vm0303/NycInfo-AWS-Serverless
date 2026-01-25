import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { v4 as uuidv4 } from "uuid";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { message: "Invalid JSON body" });
  }

  const required = ["firstName","lastName","email","phone","role","availability","whyYou","hobbies"];
  const missing = required.filter((k) => !payload[k] || String(payload[k]).trim() === "");
  if (missing.length) {
    return json(400, { message: `Missing required fields: ${missing.join(", ")}` });
  }

  const applicationId = uuidv4();
  const createdAt = payload.createdAt || new Date().toISOString();

  const item = {
    applicationId,
    createdAt,
    ...payload,
  };

  await ddb.send(new PutCommand({
    TableName: process.env.APPLICATIONS_TABLE,
    Item: item
  }));

  // SES confirmation (sandbox: recipient must be verified)
  const from = process.env.SES_FROM_EMAIL;
  const to = payload.email;

  const subject = "We received your application - NYCInfo Tours";
  const textBody =
`Hi ${payload.firstName},

Thanks for applying to NYCInfo Tours! We received your application and will review it soon.

- NYCInfo Tours`;

  try {
    await ses.send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: textBody } }
      }
    }));
  } catch (e) {
    // Don't fail the request if email fails (still stored). Return warning.
    return json(200, { ok: true, applicationId, emailSent: false, warning: "Saved, but email failed (SES sandbox?)" });
  }

  return json(200, { ok: true, applicationId, emailSent: true });
};
