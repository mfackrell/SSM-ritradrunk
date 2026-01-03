
export async function fetchBookDetails(queryParams) {
  // queryParams comes from GPT-4o step: "title=...&author=..."
  if (!queryParams) {
    console.warn("No query parameters provided. Skipping Book Details.");
    return { isbn10: null };
  }

  try {
    // --- STEP 1: SEARCH OPEN LIBRARY ---
    const searchUrl = `https://openlibrary.org/search.json?${queryParams}`;
    console.log(`Step 1: Searching Open Library: ${searchUrl}`);

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error(`Search failed: ${searchResponse.statusText}`);
    
    const searchData = await searchResponse.json();

    // "Choose First" logic from Zapier
    const firstResult = searchData.docs && searchData.docs[0];
    
    if (!firstResult || !firstResult.key) {
      console.warn("No results found in Open Library search.");
      return { isbn10: null };
    }

    const workKey = firstResult.key; // e.g., "/works/OL12345W"
    console.log(`Found Work Key: ${workKey}`);


    // --- STEP 2: FETCH EDITIONS ---
    const editionsUrl = `https://openlibrary.org${workKey}/editions.json`;
    console.log(`Step 2: Fetching Editions: ${editionsUrl}`);

    const editionsResponse = await fetch(editionsUrl);
    if (!editionsResponse.ok) throw new Error(`Editions fetch failed: ${editionsResponse.statusText}`);

    const editionsData = await editionsResponse.json();
    const entries = editionsData.entries || [];


    // --- STEP 3: FILTER & PROCESS (Your Logic) ---
    
    // Helper: Convert 13-digit ISBN to 10-digit
    function toIsbn10(isbn) {
      if (!isbn) return null;
      let clean = isbn.replace(/[^0-9X]/g, '');
      
      // If already 10 chars, return it
      if (clean.length === 10) return clean;
      
      // If 13 chars and starts with 978, we can convert it
      if (clean.length === 13 && clean.startsWith('978')) {
        const seed = clean.substring(3, 12); // Strip 978 and old check digit
        let sum = 0;
        for (let i = 0; i < 9; i++) {
          sum += parseInt(seed[i]) * (10 - i);
        }
        let remainder = sum % 11;
        let checkDigit = (11 - remainder) % 11;
        if (checkDigit === 10) checkDigit = 'X';
        return seed + checkDigit;
      }
      
      // If we can't convert (e.g. starts with 979), return original to be safe
      return clean;
    }

    let finalId = null;
    let fallbackId = null;

    for (const e of entries) {
      // 1. Check English
      // Some entries use 'languages' array with objects { key: '/languages/eng' }
      const isEnglish = e.languages && e.languages.some(l => l.key && l.key.includes('eng'));
      
      // 2. Check Paperback
      const format = (e.physical_format || '').toLowerCase();
      // Fix: If format is empty (!format), assume it is a paperback match
      const isPaperback = !format || format.includes('paperback') || format.includes('softcover');
      // 3. HUNT FOR ID
      let rawId = null;
      
      // Check Top-Level
      if (e.isbn_10 && e.isbn_10.length > 0) rawId = e.isbn_10[0];
      else if (e.isbn_13 && e.isbn_13.length > 0) rawId = e.isbn_13[0];
      
      // Check Identifiers object
      else if (e.identifiers) {
          if (e.identifiers.isbn_10 && e.identifiers.isbn_10.length > 0) rawId = e.identifiers.isbn_10[0];
          else if (e.identifiers.isbn_13 && e.identifiers.isbn_13.length > 0) rawId = e.identifiers.isbn_13[0];
          else if (e.identifiers.amazon && e.identifiers.amazon.length > 0) rawId = e.identifiers.amazon[0];
      }

      // CAPTURE FALLBACK: Save the first valid ID we find, just in case
      if (rawId && !fallbackId) {
        fallbackId = toIsbn10(rawId);
      }
      
      // 4. MATCH
      if (isEnglish && isPaperback && rawId) {
        // CONVERT TO 10-DIGIT BEFORE SAVING
        finalId = toIsbn10(rawId);
        break; // Stop at the first match
      }
    }

    console.log(`Processing Complete. Final ISBN-10: ${finalId}`);

    return { isbn10: finalId || fallbackId };
    
  } catch (error) {
    console.error("Failed to fetch/process book details:", error.message);
    return { isbn10: null, error: error.message };
  }
}
