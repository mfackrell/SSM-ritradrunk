import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

export async function getSheetRow({
  spreadsheetId,
  sheetName,
  rowNumber,
  columnRange
}) {
  const range = `${sheetName}!${columnRange}${rowNumber}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  return res.data.values?.[0] || null;
}
