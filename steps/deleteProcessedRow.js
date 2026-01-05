import { google } from "googleapis";

// The ID you provided
const SHEET_ID = "1M0sAzon8VPBqVWETCbanyFSe6zqb_VCtkEisjQtKao8";

export async function deleteProcessedRow() {
  console.log("Deleting processed row (Row 2) from Sheet1...");

  // Updated scope to allow deletion
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"], 
  });

  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  // 1. Get the numeric Sheet ID (Tab ID) for "Sheet1"
  // We look this up dynamically to ensure we target the correct tab.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID
  });

  const sheet = meta.data.sheets.find(s => s.properties.title === "Sheet1");
  if (!sheet) {
    throw new Error("Sheet1 not found in spreadsheet.");
  }
  const sheetId = sheet.properties.sheetId;

  // 2. Delete Row 2 (Index 1) using batchUpdate
  // startIndex: 1 is the second row (0-based index)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId, 
            dimension: "ROWS",
            startIndex: 1, 
            endIndex: 2    
          }
        }
      }]
    }
  });

  console.log("✅ Row 2 deleted from Sheet1.");
}
