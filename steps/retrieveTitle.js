import { getSheetRow } from "../lib/googleSheets.js";

export async function retrieveTitle(context) {
  const spreadsheetId = process.env.TRAILER_SHEET_ID;
  const sheetName = "Sheet1";
  const rowNumber = 2;
  const columnRange = "A:Z";

  const row = await getSheetRow({
    spreadsheetId,
    sheetName,
    rowNumber,
    columnRange
  });

  if (!row || row.length === 0) {
    throw new Error("No data returned from Google Sheets");
  }

  context.rawRow = row;
  context.title = row[0]; // Column A

  console.log("TITLE RETRIEVED", {
    runId: context.runId,
    title: context.title
  });

  return context;
}
