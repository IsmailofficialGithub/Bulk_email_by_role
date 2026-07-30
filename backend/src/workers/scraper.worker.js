const pc = require("picocolors");
const axios = require("axios");
const { supabase } = require("../config/supabase");
const { extractInitialContacts, extractPaginatedContacts } = require("../services/extraction.service");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processJobLogic(job) {
  const { 
    user_id, 
    auto_fetch_keywords, 
    auto_fetch_raw_headers, 
    auto_fetch_pagination_limit, 
    auto_fetch_pagination_delay_sec,
    post_age_filter,
    auto_fetch_template_role
  } = job.data;

  const log = (msg) => {
    if (job.log) job.log(msg);
    console.log(msg); 
  };
  
  let mappings = [];
  try {
    const parsed = JSON.parse(auto_fetch_keywords);
    if (Array.isArray(parsed)) mappings = parsed;
    else throw new Error("not array");
  } catch {
    if (auto_fetch_keywords && auto_fetch_keywords.trim()) {
      mappings = auto_fetch_keywords.split(",").map(k => ({
        keyword: k.trim(),
        role: auto_fetch_template_role || "fullstack"
      }));
    }
  }

  if (mappings.length === 0) {
    log(pc.bgYellow(pc.black(` ⚠️ No keywords provided. Skipping scrape. `)));
    return { inserted: 0, emails: [], phones: [] };
  }

  log(pc.bgBlue(pc.white(` [WORKER] Starting auto-apply fetch for ${mappings.length} keywords `)));

  let headers;
  try {
    headers = typeof auto_fetch_raw_headers === 'string' 
      ? JSON.parse(auto_fetch_raw_headers) 
      : auto_fetch_raw_headers;
    log(pc.green(` ✔ Parsed Headers Successfully`));
  } catch (err) {
    throw new Error(`Failed to parse raw headers: ${err.message}`);
  }

  const allEmails = new Set();
  const allPhones = new Set();
  let totalInserted = 0;
  const successfullyInsertedEmails = [];
  const successfullyInsertedPhones = [];

  log(pc.magenta(` ➜ Fetching existing contacts from DB to prevent duplicates...`));
  const { data: existingData } = await supabase
    .from('automailsend_recipients')
    .select('email, phone')
    .eq('user_id', user_id);
    
  if (existingData) {
    existingData.forEach(row => {
      if (row.email) allEmails.add(row.email.toLowerCase());
      if (row.phone) allPhones.add(row.phone);
    });
  }

  const { data: sentLogData } = await supabase
    .from('automailsend_sent_log')
    .select('email')
    .eq('user_id', user_id);
    
  if (sentLogData) {
    sentLogData.forEach(row => {
      if (row.email) allEmails.add(row.email.toLowerCase());
    });
  }
  
  log(pc.green(` ✔ Loaded ${allEmails.size} emails and ${allPhones.size} phones to skip (including sent log).`));

  const saveContacts = async (contacts, roleToAssign) => {
    const newEmails = contacts.emails.filter(e => !allEmails.has(e.toLowerCase()));
    const newPhones = contacts.phones.filter(p => !allPhones.has(p));
    
    if (newEmails.length === 0 && newPhones.length === 0) return;

    const newContactsToInsert = [];
    const maxLength = Math.max(newEmails.length, newPhones.length);
    for (let i = 0; i < maxLength; i++) {
      newContactsToInsert.push({ email: newEmails[i] || null, phone: newPhones[i] || null });
    }

    log(pc.magenta(` ➜ Inserting ${newContactsToInsert.length} new records into Supabase for role '${roleToAssign}'...`));
    for (const entry of newContactsToInsert) {
      const emailToInsert = entry.email ? entry.email.toLowerCase() : "";
      const phoneToInsert = entry.phone || "";
      const { error } = await supabase.from("automailsend_recipients").insert({
        user_id,
        email: emailToInsert,
        phone: phoneToInsert,
        role: roleToAssign, 
        title: "",
        source: "auto_fetch",
        context_text: contacts.contextText || null,
      });
      if (error) {
         log(pc.bgRed(pc.white(` ✖ Supabase insert error: ${error.message} `)));
      } else {
         totalInserted++;
         if (emailToInsert) {
           allEmails.add(emailToInsert);
           successfullyInsertedEmails.push(emailToInsert);
         }
         if (phoneToInsert) {
           allPhones.add(phoneToInsert);
           successfullyInsertedPhones.push(phoneToInsert);
         }
      }
    }
  };

  for (const mapping of mappings) {
    const currentKeyword = mapping.keyword;
    const currentRole = mapping.role;

    log(pc.bgBlue(pc.white(`\n[WORKER] Searching for keyword: "${currentKeyword}" (Role: ${currentRole})`)));

    const keywordsQuery = encodeURIComponent(currentKeyword);
    const searchBase = process.env.LINKEDIN_SEARCH_BASE_URL || "https://www.linkedin.com/search/results/content/";
    let searchUrl = `${searchBase}?keywords=${keywordsQuery}&origin=SWITCH_SEARCH_VERTICAL`;
    
    if (post_age_filter && post_age_filter !== 'any') {
      searchUrl += `&datePosted=%22${encodeURIComponent(post_age_filter)}%22`;
    }

    log(pc.magenta(` ➜ Fetching Initial Search Page: ${searchUrl}`));
    let response;
    try {
      response = await axios.get(searchUrl, { headers, responseType: 'text' });
    } catch (err) {
      const errorDetails = err.response ? `HTTP ${err.response.status}` : err.message;
      log(pc.bgRed(pc.white(` ✖ Search request failed for "${currentKeyword}": ${errorDetails} `)));
      continue; // Skip to next keyword
    }

    const rawText = response.data;
    log(pc.green(` ✔ Initial Search Page Loaded (HTTP ${response.status}) [${rawText.length} bytes]`));

    log(pc.magenta(` ➜ Extracting Contacts from Initial Page...`));
    const initialContacts = extractInitialContacts(rawText);
    let initialDetails = "";
    if (initialContacts.emails.length > 0) initialDetails += ` [Emails: ${initialContacts.emails.join(", ")}]`;
    if (initialContacts.phones.length > 0) initialDetails += ` [Phones: ${initialContacts.phones.join(", ")}]`;
    log(pc.green(` ✔ Initial Page Found: ${initialContacts.emails.length} emails, ${initialContacts.phones.length} phones${initialDetails}`));

    await saveContacts(initialContacts, currentRole);

    // Extract Pagination info
    let raw = rawText.replace(/\\+"/g, '"').replace(/&quot;/g, '"');
    const searchId = (raw.match(/"searchId"\s*:\s*"([0-9a-fA-F-]{36})"/) || [])[1];
    
    if (!searchId) {
      log(pc.bgYellow(pc.black(` ⚠️ No searchId found, cannot paginate for "${currentKeyword}". `)));
    } else {
      const rawKeywords = ((raw.match(/"keywords"\s*:\s*"((?:\\.|[^"\\])*)"/) || [])[1] || currentKeyword).replace(/\\"/g, '"');
      let startIndex = Number((raw.match(/"startIndex"\s*:\s*(\d+)/) || [])[1] || 12);
      const count = Number((raw.match(/"count"\s*:\s*(\d+)/) || [])[1] || 3);
      let clusterStartPosition = Number((raw.match(/"clusterStartPosition"\s*:\s*(\d+)/) || [])[1] || 9);
      
      const maxPages = auto_fetch_pagination_limit || 1;
      const defaultInterval = process.env.SCRAPER_INTERVAL_SEC ? parseInt(process.env.SCRAPER_INTERVAL_SEC, 10) : 10;
      const delayMs = (auto_fetch_pagination_delay_sec || defaultInterval) * 1000;

      log(pc.bgBlue(pc.white(` [WORKER] Pagination details found for "${currentKeyword}". Max Pages: ${maxPages}, Delay: ${delayMs/1000}s `)));

      for (let page = 1; page <= maxPages; page++) {
        log(pc.cyan(` ⏳ Fetching page ${page} of ${maxPages}... (waiting ${delayMs/1000}s)`));
        await sleep(delayMs);

        const payload = {
          startIndex,
          keywords: rawKeywords,
          count,
          sortBy: [],
          postedBy: [],
          datePosted: post_age_filter && post_age_filter !== 'any' ? [post_age_filter] : [],
          contentType: [],
          fromMember: [],
          mentionsOrganization: [],
          mentionsMember: [],
          fromOrganization: [],
          authorCompany: [],
          authorIndustry: [],
          authorJobTitle: [],
          spellCheckEnabled: true,
          clusterStartPosition,
          searchId,
        };

        const body = {
          pagerId: 'com.linkedin.sdui.search.contentSearchResults',
          clientArguments: {
            $type: 'proto.sdui.actions.requests.RequestedArguments',
            requestedStateKeys: [],
            payload,
            requestMetadata: { $type: 'proto.sdui.common.RequestMetadata' },
            states: [],
            screenId: 'com.linkedin.sdui.flagshipnav.search.SearchResultsContent',
          },
          paginationRequest: {
            $type: 'proto.sdui.actions.requests.PaginationRequest',
            pagerId: 'com.linkedin.sdui.search.contentSearchResults',
            trigger: {
              $case: 'itemDistanceTrigger',
              itemDistanceTrigger: {
                $type: 'proto.sdui.actions.requests.ItemDistanceTrigger',
                preloadDistance: 3,
                preloadLength: 1500,
              },
            },
            retryCount: 2,
            requestedArguments: {
              $type: 'proto.sdui.actions.requests.RequestedArguments',
              requestedStateKeys: [],
              payload: {
                ...payload,
                startIndex: startIndex + count,
                clusterStartPosition: clusterStartPosition + 2,
              },
              requestMetadata: { $type: 'proto.sdui.common.RequestMetadata' },
            },
          },
        };

        log(pc.magenta(` ➜ Executing POST /rsc-action/actions/pagination for page ${page}`));
        try {
          const paginationUrl = process.env.LINKEDIN_PAGINATION_URL || "https://www.linkedin.com/flagship-web/rsc-action/actions/pagination";
          const paginatedRes = await axios.post(`${paginationUrl}?sduiid=com.linkedin.sdui.search.contentSearchResults`, body, {
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            responseType: 'text'
          });

          const paginatedText = paginatedRes.data;
          
          const paginatedContacts = extractPaginatedContacts(paginatedText);
          
          let paginatedDetails = "";
          if (paginatedContacts.emails.length > 0) paginatedDetails += ` [Emails: ${paginatedContacts.emails.join(", ")}]`;
          if (paginatedContacts.phones.length > 0) paginatedDetails += ` [Phones: ${paginatedContacts.phones.join(", ")}]`;
          log(pc.green(` ✔ Page ${page} Found: ${paginatedContacts.emails.length} emails, ${paginatedContacts.phones.length} phones${paginatedDetails}`));

          await saveContacts(paginatedContacts, currentRole);

        } catch (err) {
          const errorDetails = err.response ? `HTTP ${err.response.status}` : err.message;
          log(pc.bgRed(pc.white(` ✖ Paginated request error: ${errorDetails} `)));
        }

        startIndex += count;
        clusterStartPosition += 2;
      }
    }
  }

  log(pc.bgGreen(pc.white(` [WORKER] Total Unique Contacts Inserted: ${totalInserted} `)));

  if (totalInserted === 0) {
    log(pc.bgYellow(pc.black(` ⚠️ No new records to insert. `)));
  } else {
    log(pc.bgCyan(pc.black(` ✔ Insertion successful! `)));
  }

  return { inserted: totalInserted, emails: successfullyInsertedEmails, phones: successfullyInsertedPhones };
}

async function processJob(job) {
  const { user_id, auto_fetch_keywords } = job.data;
  let logId = null;

  const dbLog = async (status, message, details = {}) => {
    try {
      if (!logId) {
        let res = await supabase
          .from("automailsend_execution_logs")
          .insert([{ user_id, status, message, details }])
          .select("id")
          .single();
        if (res.error) {
          res = await supabase
            .from("automailsend_execution_logs")
            .insert([{ user_id, status, message }])
            .select("id")
            .single();
        }
        if (res.error) throw res.error;
        if (res.data) logId = res.data.id;
      } else {
        let res = await supabase
          .from("automailsend_execution_logs")
          .update({ status, message, details })
          .eq("id", logId);
        if (res.error) {
          res = await supabase
            .from("automailsend_execution_logs")
            .update({ status, message })
            .eq("id", logId);
        }
      }
    } catch (err) {
      console.error(pc.bgRed(pc.white(` [DB LOG ERROR] Failed to save log: ${err.message} `)));
    }
  };

  try {
    await dbLog("running", `Execution started for keywords: "${auto_fetch_keywords}"`);
    const result = await processJobLogic(job);
    const detailsObj = { new_emails: result.emails, new_phones: result.phones };
    await dbLog("success", `Execution finished. Inserted ${result.inserted} new unique records.`, detailsObj);
    return result;
  } catch (err) {
    const errorDetails = { stack: err.stack, name: err.name };
    await dbLog("error", `Execution failed: ${err.message}`, errorDetails);
    throw err;
  }
}

module.exports = { processJob };
