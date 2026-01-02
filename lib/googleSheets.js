import { google } from "googleapis";

const SHEET_ID = "1M0sAzon8VPBqWETCbanyFSe6zqb_VCtkEisjQtKao8";

export async function getFirstTitle() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient(),
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A2:A2", // first title only
  });

  const title = res.data.values?.[0]?.[0];

  if (!title) {
    throw new Error("No title found in Sheet");
  }

  return title;
}
