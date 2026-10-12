
const crypto = require("crypto");

const MAX_AGE_MS = 10 * 60 * 1000;

function getSecret() {
  const secret = process.env.GEOFENCE_SIGNING_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "GEOFENCE_SIGNING_SECRET must be at least 32 characters."
    );
  }

  return secret;
}

function signLocation(location, userId) {
  const payload = {
    ...location,
    userId: String(userId),
    expiresAt: Date.now() + MAX_AGE_MS,
  };

  const encoded = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyLocationTicket(ticket, userId) {
  if (
    typeof ticket !== "string" ||
    ticket.length > 5000
  ) {
    throw new Error("Invalid workplace selection.");
  }

  const parts = ticket.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid workplace selection.");
  }

  const [encoded, providedSignature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);

  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    throw new Error("Workplace location was modified.");
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
  } catch {
    throw new Error("Invalid workplace selection.");
  }

  if (
    payload.userId !== String(userId) ||
    typeof payload.expiresAt !== "number" ||
    Date.now() > payload.expiresAt
  ) {
    throw new Error(
      "Workplace selection expired. Search again."
    );
  }

  if (
    typeof payload.address !== "string" ||
    !payload.address.trim() ||
    typeof payload.latitude !== "number" ||
    typeof payload.longitude !== "number" ||
    !Number.isFinite(payload.latitude) ||
    !Number.isFinite(payload.longitude) ||
    Math.abs(payload.latitude) > 90 ||
    Math.abs(payload.longitude) > 180
  ) {
    throw new Error("Invalid workplace coordinates.");
  }

  return payload;
}

module.exports = {
  signLocation,
  verifyLocationTicket,
};
