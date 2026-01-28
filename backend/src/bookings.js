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

  const required = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "dateTime",
    "numAdults",
    "numChildren",
    "total",
  ];

  const missing = required.filter((k) => {
    const v = payload[k];
    if (v === undefined || v === null) return true;
    return typeof v === "string" && v.trim() === "";

  });

  if (missing.length) {
    return json(400, { message: `Missing required fields: ${missing.join(", ")}` });
  }

  const bookingId = uuidv4();
  const createdAt = payload.createdAt || new Date().toISOString();

  // IMPORTANT: payment details are not accepted/stored.
  const { cardNumber, expirationDate, securityCode, ...safePayload } = payload;

  const item = { bookingId, createdAt, ...safePayload };

  try {
    await ddb.send(
        new PutCommand({
          TableName: process.env.BOOKINGS_TABLE,
          Item: item,
        })
    );
  } catch (e) {
    return json(500, { message: "Failed to save booking", error: e?.message || String(e) });
  }

  const from = process.env.SES_FROM_EMAIL;
  const to = payload.email;

  const tourPackageLine = payload.tourPackageLabel
      ? `Tour Package: ${payload.tourPackageLabel}`
      : `Tour Package: ${payload.tourPackage || "N/A"}`;

  const transportationLine = payload.transportationLabel
      ? `Transportation: ${payload.transportationLabel}`
      : `Transportation: None`;

  const subject = "Your NYCInfo Tours booking is confirmed! 🗽";

  const textBody = `Hi ${payload.firstName},

Your NYCInfo Tours booking is confirmed — we can’t wait to see you!

Here are your booking details:

${tourPackageLine}
${transportationLine}
Guests: ${payload.numAdults} adult(s), ${payload.numChildren} child(ren)
Date & Time: ${payload.dateTime}
Total Price: $${Number(payload.total).toFixed(2)}

Need to make changes?
Please reach out to contacts@nycinfotours.app or call us at +1 (212) 555-0147.

Get ready for an unforgettable NYC experience 🗽✨
— NYCInfo Tours
`;

  try {
    await ses.send(
        new SendEmailCommand({
          Source: from,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: textBody } },
          },
        })
    );
  } catch (e) {
    // still return OK because booking was saved successfully
    return json(200, {
      ok: true,
      bookingId,
      emailSent: false,
      warning: "Saved, but email failed (SES sandbox / not verified?)",
    });
  }

  return json(200, { ok: true, bookingId, emailSent: true });
};
