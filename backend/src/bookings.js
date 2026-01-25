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

  const required = ["firstName","lastName","email","phone","dateTime","numAdults","numChildren","total"];
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null || String(payload[k]).trim?.() === "");
  if (missing.length) return json(400, { message: `Missing required fields: ${missing.join(", ")}` });

  const bookingId = uuidv4();
  const createdAt = payload.createdAt || new Date().toISOString();

  // IMPORTANT: payment details are not accepted/stored.
  const { cardNumber, expirationDate, securityCode, ...safePayload } = payload;

  const item = { bookingId, createdAt, ...safePayload };

  await ddb.send(new PutCommand({
    TableName: process.env.BOOKINGS_TABLE,
    Item: item
  }));

  const from = process.env.SES_FROM_EMAIL;
  const to = payload.email;

  const subject = "Your NYCInfo Tours booking request was received";
  const textBody =
`Hi ${payload.firstName},

Thanks! We received your booking request.

Date/Time: ${payload.dateTime}
Total: $${payload.total}

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
    return json(200, { ok: true, bookingId, emailSent: false, warning: "Saved, but email failed (SES sandbox?)" });
  }

  return json(200, { ok: true, bookingId, emailSent: true });
};
