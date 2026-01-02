import { getSheetValues } from "../lib/googleSheets.js";

export async function retrieveTitle() {
  const spreadsheetId = "1M0sAzon8VPBqWVETCbanyFSe6zqb_VCtkEisjQtkao8";
  const range = "Sheet1!A2:A2";

  const values = await getSheetValues(spreadsheetId, range);

  const title = values?.[0]?.[0];

  if (!title) {
    throw new Error("No title found in Sheet1!A2");
  }

  console.log("Retrieved title:", title);

  return title;
}

