import { getFirstTitle } from "../lib/googleSheets.js";

export async function retrieveTitle() {
  const title = await getFirstTitle();
  console.log("Retrieved title:", title);
  return title;
}


