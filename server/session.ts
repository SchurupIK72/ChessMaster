export const sessionCookieName = "connect.sid";

export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "lax" as const,
};
