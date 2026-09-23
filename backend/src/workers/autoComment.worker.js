const pc = require("picocolors");
const axios = require("axios");
const { ExecutionLogger } = require("../lib/logger");
const { generateAiComment } = require("../services/ai.service");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStartOfDayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function mapUrnsToTexts(rawText) {
  const urnToText = {};
  if (!rawText) return urnToText;
  
  const rawString = typeof rawText === "string" ? rawText : JSON.stringify(rawText);
  const jsonBlocks = [];
  
  // Extract LinkedIn BigPipe code blocks
  const codeBlocks = rawString.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
  for (const block of codeBlocks) {
    let content = block.replace(/<code[^>]*>/i, '').replace(/<\/code>/i, '').trim();
    // Strip HTML comments <!-- and -->
    if (content.startsWith('<!--')) {
      content = content.replace(/^<!--\s*/, '').replace(/\s*-->$/, '');
    }
    try {
      const decoded = content
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      jsonBlocks.push(JSON.parse(decoded));
    } catch (e) {}
  }

  // Extract application/json script blocks
  const scriptBlocks = rawString.match(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of scriptBlocks) {
    const content = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    try {
      jsonBlocks.push(JSON.parse(content));
    } catch (e) {}
  }
  
  try {
    jsonBlocks.push(JSON.parse(rawString));
  } catch (e) {}
  
  // Map of standalone commentary URNs for normalized payloads
  const commentaryMap = {};

  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
      return;
    }
    
    // Check if this is a commentary entity in normalized JSON
    const entityUrn = obj.entityUrn || obj.urn;
    if (typeof entityUrn === "string" && entityUrn.includes("commentary")) {
      const cText = obj.text?.text || obj.text;
      if (typeof cText === "string" && cText.trim()) {
        commentaryMap[entityUrn] = cText.trim();
      }
    }
    
    let activityId = null;
    for (const key of ['urn', 'entityUrn', 'trackingId', 'id']) {
      if (typeof obj[key] === 'string') {
        const m = obj[key].match(/urn:li:activity:(\d{19})/);
        if (m) {
          activityId = m[1];
          break;
        }
      }
    }
    if (!activityId && obj.updateMetadata && typeof obj.updateMetadata.urn === "string") {
      const m = obj.updateMetadata.urn.match(/urn:li:activity:(\d{19})/);
      if (m) activityId = m[1];
    }
    
    if (activityId) {
      let text = "";
      if (obj.commentary && obj.commentary.text && typeof obj.commentary.text.text === "string") {
        text = obj.commentary.text.text;
      } else if (obj.commentary && typeof obj.commentary.text === "string") {
        text = obj.commentary.text;
      } else if (typeof obj.commentary === "string" && commentaryMap[obj.commentary]) {
        text = commentaryMap[obj.commentary];
      } else if (obj.updateMetadata && obj.updateMetadata.commentary && typeof obj.updateMetadata.commentary.text === "string") {
        text = obj.updateMetadata.commentary.text;
      } else if (obj.specificContent && obj.specificContent['com.linkedin.ugc.ShareContent']?.shareCommentary?.text) {
        text = obj.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
      } else if (obj.text && typeof obj.text.text === "string") {
        text = obj.text.text;
      } else if (typeof obj.text === "string" && obj.text.length > 20) {
        text = obj.text;
      }
      if (text && text.trim() && text.trim() !== "Post | LinkedIn") {
        urnToText[activityId] = text.trim();
      }
    }
    
    for (const key of Object.keys(obj)) {
      traverse(obj[key]);
    }
  }
  
  jsonBlocks.forEach(traverse);

  // Second pass to resolve any commentaries that were traversed before their definition
  if (Object.keys(commentaryMap).length > 0) {
    jsonBlocks.forEach(function resolveComments(obj) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(resolveComments); return; }
      let activityId = null;
      for (const key of ['urn', 'entityUrn', 'trackingId']) {
        if (typeof obj[key] === 'string') {
          const m = obj[key].match(/urn:li:activity:(\d{19})/);
          if (m) { activityId = m[1]; break; }
        }
      }
      if (activityId && !urnToText[activityId] && typeof obj.commentary === "string" && commentaryMap[obj.commentary]) {
        urnToText[activityId] = commentaryMap[obj.commentary];
      }
      for (const key of Object.keys(obj)) resolveComments(obj[key]);
    });
  }

  return urnToText;
}

// Extract underlying attributed URNs (ugcPost or share) from search or feed results
function extractAttributedUrns(rawText) {
  const urnMap = {};
  if (!rawText) return urnMap;
  
  const rawString = typeof rawText === "string" ? rawText : JSON.stringify(rawText);
  
  // 1. HTML data attributes: data-activity-urn and data-attributed-urn
  const regex1 = /data-activity-urn=["']urn:li:activity:(\d{19})["'][^>]*?data-attributed-urn=["'](urn:li:(?:ugcPost|share):\d+)["']/gi;
  for (const match of rawString.matchAll(regex1)) {
    urnMap[match[1]] = match[2];
  }
  const regex2 = /data-attributed-urn=["'](urn:li:(?:ugcPost|share):\d+)["'][^>]*?data-activity-urn=["']urn:li:activity:(\d{19})["']/gi;
  for (const match of rawString.matchAll(regex2)) {
    urnMap[match[2]] = match[1];
  }

  // 2. Semaphore comment anchors
  const regexSem = /urn:li:activity:(\d{19})[\s\S]{0,500}?data-semaphore-content-urn=["']urn:li:comment:\(((?:urn:li:)?(?:ugcPost|share):\d+)/gi;
  for (const match of rawString.matchAll(regexSem)) {
    const urn = match[2].startsWith('urn:li:') ? match[2] : `urn:li:${match[2]}`;
    if (!urnMap[match[1]]) urnMap[match[1]] = urn;
  }

  return urnMap;
}

// Extract true commentable entity URN (ugcPost or share) from post HTML
function resolveAttributedUrnFromHtml(html, activityId) {
  if (!html) return null;
  
  // 1. Card containing the target activityId
  const cardMatch = html.match(new RegExp(`data-activity-urn=["']urn:li:activity:${activityId}["'][^>]*data-attributed-urn=["']([^"']+)["']`, 'i')) ||
                    html.match(new RegExp(`data-attributed-urn=["']([^"']+)["'][^>]*data-activity-urn=["']urn:li:activity:${activityId}["']`, 'i'));
  if (cardMatch && cardMatch[1]) return cardMatch[1];

  // 2. Semaphore comment container
  const semMatch = html.match(/data-semaphore-content-urn=["']urn:li:comment:\(((?:urn:li:)?(?:ugcPost|share):\d+)/i) ||
                   html.match(/urn:li:comment:\(((?:urn:li:(?:ugcPost|share):\d+))/i);
  if (semMatch && semMatch[1]) {
    return semMatch[1].startsWith('urn:li:') ? semMatch[1] : `urn:li:${semMatch[1]}`;
  }

  // 3. Fallback to any attributed URN on page
  const attrMatch = html.match(/data-attributed-urn=["'](urn:li:(?:ugcPost|share):\d+)["']/i);
  if (attrMatch && attrMatch[1]) return attrMatch[1];

  return null;
}

async function runAutoCommentJobs(supabase) {
  try {
    const { data: users, error: usersErr } = await supabase
      .from("automailsend_app_state")
      .select("*")
      .eq("auto_comment_enabled", true);

    if (usersErr) throw usersErr;

    if (!users || users.length === 0) return;

    for (const user of users) {
      const userId = user.user_id;
      const limit = parseInt(user.auto_comment_limit, 10) || 10;
      const intervalMin = Math.max(1, parseInt(user.auto_comment_interval_min, 10) || 1);
      const promptTemplate = user.auto_comment_prompt;
      
      const aiProvider = user.ai_provider || "none";
      const aiApiKey = user.ai_api_key;
      
      const liAt = user.cookie_li_at;
      const jsessionid = user.cookie_jsessionid;

      // Fetch OAuth token if the user connected LinkedIn officially
      const { data: linkedinAuth } = await supabase
        .from('linkedin_accounts')
        .select('access_token, linkedin_person_urn')
        .eq('user_id', userId)
        .single();

      let rawHeaders = user.auto_fetch_raw_headers || "{}";

      if (user.is_blocked) continue;

      if (!liAt || !jsessionid || !promptTemplate || aiProvider === "none" || !aiApiKey) {
        continue;
      }

      // Check last comment time to enforce interval without sleeping
      const { data: lastComments } = await supabase
        .from("automailsend_linkedin_comments_log")
        .select("sent_at")
        .eq("user_id", userId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1);
      
      const lastComment = lastComments && lastComments.length > 0 ? lastComments[0] : null;
      
      if (lastComment) {
        const lastTime = new Date(lastComment.sent_at).getTime();
        const now = new Date().getTime();
        const diffMin = (now - lastTime) / (60 * 1000);
        if (diffMin < intervalMin) {
          console.log(`[AutoComment Worker] User ${userId.substring(0,8)}... skipping. Next comment allowed in ${(intervalMin - diffMin).toFixed(1)} mins.`);
          continue; // Skip this user until next cron tick
        }
      }

      const { count: commentedToday, error: countErr } = await supabase
        .from("automailsend_linkedin_comments_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "sent")
        .gte("sent_at", getStartOfDayUTC());

      if (countErr) {
        console.error(pc.red(`Error fetching comments count for user ${userId}: ${countErr.message}`));
        continue;
      }

      const remainingQuota = limit - (commentedToday || 0);
      if (remainingQuota <= 0) continue;

      // Fetch all previously commented URLs to avoid duplicates
      const { data: prevComments, error: prevErr } = await supabase
        .from("automailsend_linkedin_comments_log")
        .select("post_url")
        .eq("user_id", userId);

      const commentedUrls = new Set((prevComments || []).map(c => c.post_url));

      const rawKeywords = user.auto_comment_keywords ? user.auto_comment_keywords.split(",").map(k => k.trim()).filter(Boolean) : [];
      
      const cleanJsession = jsessionid ? jsessionid.replace(/"/g, '') : '';
      let fetchUrl = process.env.LINKEDIN_FEED_URL || "https://www.linkedin.com/voyager/api/feed/updatesV2?count=20&q=feed";
      let keywordUsed = null;
      if (rawKeywords.length > 0) {
        // pick a random keyword for variety
        keywordUsed = rawKeywords[Math.floor(Math.random() * rawKeywords.length)];
        const keywordsQuery = encodeURIComponent(keywordUsed);
        const searchBase = process.env.LINKEDIN_SEARCH_CONTENT_BASE || "https://www.linkedin.com/search/results/content/";
        fetchUrl = `${searchBase}?keywords=${keywordsQuery}&origin=SWITCH_SEARCH_VERTICAL`;
      }

      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(rawHeaders);
      } catch (e) {}
      
      let headers = {};
      try {
        if (parsedHeaders && Object.keys(parsedHeaders).length > 0) {
          headers = parsedHeaders; // Use the exact headers the user stored in the DB
        } else {
          throw new Error("Empty headers");
        }
      } catch (e) {
        // Fallback if raw_headers is missing or empty
        headers = {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0",
          "x-restli-protocol-version": "2.0.0",
          "csrf-token": cleanJsession,
          "Cookie": `li_at=${liAt}; JSESSIONID="${cleanJsession}";`
        };
      }
      
      // Enforce latest tokens
      headers['csrf-token'] = cleanJsession;
      if (headers['cookie'] || headers['Cookie']) {
         let cookieStr = headers['cookie'] || headers['Cookie'];
         cookieStr = cookieStr.replace(/li_at=[^;]+/, `li_at=${liAt}`);
         cookieStr = cookieStr.replace(/JSESSIONID="?[^;]+"?/, `JSESSIONID="${cleanJsession}"`);
         headers['cookie'] = cookieStr;
         delete headers['Cookie'];
      } else {
         headers['cookie'] = `li_at=${liAt}; JSESSIONID="${cleanJsession}"`;
      }

      console.log(`[AutoComment Worker] User ${userId.substring(0,8)} fetching posts from: ${fetchUrl}`);

      let response;
      try {
        response = await axios.get(fetchUrl, { headers: headers, responseType: 'text' });
      } catch (err) {
        console.error(`[AutoComment Worker] Error fetching posts: ${err.message}`);
        continue;
      }

      const rawText = response.data;
      const urnToTextMap = mapUrnsToTexts(rawText);
      const urnToAttributedMap = extractAttributedUrns(rawText);
      const urnMatches = rawText.match(/urn:li:activity:(\d{19})/g) || [];
      const uniqueUrns = [...new Set(urnMatches.map(m => m.match(/urn:li:activity:(\d{19})/)[1]))];

      const postBase = process.env.LINKEDIN_POST_BASE || "https://www.linkedin.com/feed/update/urn:li:activity:";
      const candidatesUrls = uniqueUrns.map(id => `${postBase}${id}/`);
      
      const candidates = candidatesUrls.filter(u => !commentedUrls.has(u));

      if (candidates.length === 0) {
        console.log(`[AutoComment Worker] User ${userId.substring(0,8)} has no new posts to comment on. (Checked ${uniqueUrns.length} posts)`);
        continue;
      }

      const logger = new ExecutionLogger(userId, "auto_comment");
      await logger.start(`Starting Auto-Comment batch process...`);
      await logger.append("INFO", `Quota: ${remainingQuota}, Candidates found: ${candidates.length}${keywordUsed ? ` (Keyword: ${keywordUsed})` : " (Home Feed)"}`);

      let sentCount = 0;
      for (const targetUrl of candidates) {
        if (sentCount >= remainingQuota) break;

        // Extract ID (19 digits) from URL
        const idMatch = targetUrl.match(/(\d{19})/);
        if (!idMatch) {
          await logger.append("WARN", `Could not extract 19-digit ID from URL: ${targetUrl}. Skipping.`);
          continue;
        }
        
        const activityId = idMatch[1];
        // Activity URN for feed actions, attributed URN for comment threads
        const activityUrn = `urn:li:activity:${activityId}`;
        let targetAttributedUrn = (urnToAttributedMap && urnToAttributedMap[activityId]) || null;

        await logger.append("INFO", `Attempting to Like post to check for duplicates: ${targetUrl}`);
        
        let headers = {};
        try {
          const parsed = JSON.parse(rawHeaders);
          if (parsed && Object.keys(parsed).length > 0) {
            headers = parsed; // Use the exact headers the user stored in the DB
          } else {
            throw new Error("Empty headers");
          }
        } catch (e) {
          // Fallback if raw_headers is missing or empty
          const cleanJsession = jsessionid ? jsessionid.replace(/"/g, '') : '';
          headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
            "x-restli-protocol-version": "2.0.0",
            "csrf-token": cleanJsession,
            "Cookie": `li_at=${liAt}; JSESSIONID="${cleanJsession}";`
          };
        }

        const cleanJsession = jsessionid ? jsessionid.replace(/"/g, '') : '';
        
        // FORCE update csrf-token to match the latest JSESSIONID
        headers['csrf-token'] = cleanJsession;
        delete headers['Csrf-Token'];
        
        // FORCE update cookies in the headers to use the latest li_at and JSESSIONID
        if (headers['cookie'] || headers['Cookie']) {
           let cookieStr = headers['cookie'] || headers['Cookie'];
           cookieStr = cookieStr.replace(/li_at=[^;]+/, `li_at=${liAt}`);
           cookieStr = cookieStr.replace(/JSESSIONID="?[^;]+"?/, `JSESSIONID="${cleanJsession}"`);
           headers['cookie'] = cookieStr;
           delete headers['Cookie'];
        } else {
           headers['cookie'] = `li_at=${liAt}; JSESSIONID="${cleanJsession}"`;
        }

        let alreadyLiked = false;
        let likeSuccess = false;
        try {
          const sduiPayload = {
            "requestId": "com.linkedin.sdui.reactions.create",
            "serverRequest": {
                "requestId": "com.linkedin.sdui.reactions.create",
                "requestedArguments": {
                    "$type": "proto.sdui.actions.requests.RequestedArguments",
                    "requestedStateKeys": [],
                    "payload": {
                        "threadUrn": {
                            "threadUrnActivityThreadUrn": {
                                "activityUrn": {
                                    "activityId": activityId
                                }
                            }
                        },
                        "reactionType": "ReactionType_LIKE",
                        "reactionSource": "Update"
                    },
                    "requestMetadata": {
                        "$type": "proto.sdui.common.RequestMetadata"
                    }
                },
                "onClientRequestFailureAction": {
                    "actions": []
                },
                "isApfcEnabled": false,
                "isStreaming": false,
                "rumPageKey": ""
            },
            "states": [],
            "requestedArguments": {
                "$type": "proto.sdui.actions.requests.RequestedArguments",
                "requestedStateKeys": [],
                "payload": {
                    "threadUrn": {
                        "threadUrnActivityThreadUrn": {
                            "activityUrn": {
                                "activityId": activityId
                            }
                        }
                    },
                    "reactionType": "ReactionType_LIKE",
                    "reactionSource": "Update"
                },
                "requestMetadata": {
                    "$type": "proto.sdui.common.RequestMetadata"
                },
                "states": [],
                "screenId": "com.linkedin.sdui.flagshipnav.search.SearchResultsContent",
                "knownTemplateIds": []
            }
          };

          const flagshipUrl = process.env.LINKEDIN_REACTION_FLAGSHIP_URL || 'https://www.linkedin.com/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.reactions.create';
          
          // Must include specific headers for flagship-web requests
          const flagshipHeaders = { ...headers };
          flagshipHeaders['csrf-token'] = flagshipHeaders['csrf-token'] || cleanJsession;
          
          const flagshipRes = await axios.post(flagshipUrl, sduiPayload, { headers: flagshipHeaders });
          
          // SDUI can return 200 OK but contain errors or failureActions in the payload
          const resDataStr = JSON.stringify(flagshipRes.data || {});
          if (resDataStr.includes('"failureAction"') || resDataStr.includes('"errors"')) {
            throw new Error("SDUI responded with 200 OK but payload indicates failure");
          }

          await logger.append("INFO", `Successfully liked the post (SDUI Flagship)!`);
          likeSuccess = true;
        } catch (err) {
          const status = err.response ? err.response.status : 0;
          if (status === 400 || status === 409 || status === 403) {
            alreadyLiked = true;
            likeSuccess = true;
          } else {
            // Try older dash endpoint just in case
            try {
              const dashHeaders = {
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
                'x-restli-protocol-version': '2.0.0',
                'content-type': 'application/json; charset=UTF-8'
              };
              for (const key of Object.keys(headers)) {
                const lkey = key.toLowerCase();
                if (['cookie', 'csrf-token', 'user-agent', 'referer', 'origin'].includes(lkey)) {
                  dashHeaders[lkey] = headers[key];
                }
              }

              const fallbackReactionUrl = process.env.LINKEDIN_REACTION_FALLBACK_URL || 'https://www.linkedin.com/voyager/api/voyagerSocialDashReactions?action=create';
              await axios.post(fallbackReactionUrl, {
                threadUrn: activityUrn,
                reactionType: "LIKE"
              }, { headers: dashHeaders });
              await logger.append("INFO", `Successfully liked the post (Dash fallback)!`);
              likeSuccess = true;
            } catch (err2) {
              const status2 = err2.response ? err2.response.status : 0;
              if (status2 === 400 || status2 === 409 || status2 === 403) {
                alreadyLiked = true;
                likeSuccess = true;
              } else {
                const errMsg = err2.response && err2.response.data ? JSON.stringify(err2.response.data) : err2.message;
                await logger.append("WARN", `Failed to like post: ${errMsg}`);
              }
            }
          }
        }

        if (alreadyLiked) {
          await logger.append("WARN", `Post already liked previously (duplicate). Skipping comment generation.`);
          commentedUrls.add(targetUrl);
          continue;
        }
        
        if (!likeSuccess) {
          await logger.append("ERROR", "Like failed! Skipping comment as per strict settings.");
          await supabase.from("automailsend_linkedin_comments_log").insert({
            user_id: userId,
            post_url: targetUrl,
            comment_text: "SKIPPED_LIKE_FAILED",
            status: "failed",
            error_message: "Like failed, so comment was not sent",
            sent_at: new Date().toISOString()
          });
          commentedUrls.add(targetUrl);
          continue;
        }

        await logger.append("INFO", `Generating AI comment for post: ${targetUrl}`);
        
        let commentText = "";
        let skipReason = null;
        let postText = "";
        
        if (urnToTextMap && urnToTextMap[activityId] && urnToTextMap[activityId].length > 15) {
          postText = urnToTextMap[activityId];
          await logger.append("INFO", `Using pre-extracted post content from search results.`);
        } else {
          try {
            await logger.append("INFO", `Fetching post content for AI context...`);
            
            // 1. Try Voyager API first for clean structured JSON
            let fetchedContent = false;
            try {
              const voyagerUrl = `https://www.linkedin.com/voyager/api/feed/updatesV2/urn:li:activity:${activityId}`;
              const vHeaders = {
                ...headers,
                "Accept": "application/vnd.linkedin.normalized+json+2.1,application/json"
              };
              const vRes = await axios.get(voyagerUrl, { headers: vHeaders, timeout: 8000 });
              if (vRes.data) {
                const vMap = mapUrnsToTexts(vRes.data);
                if (vMap[activityId] && vMap[activityId].length > 15) {
                  postText = vMap[activityId];
                  fetchedContent = true;
                  await logger.append("INFO", `Extracted post text via Voyager API.`);
                }
              }
            } catch (vErr) {
              // Proceed to HTML fetch if Voyager direct fetch fails
            }

            // 2. Fallback to HTML fetch if Voyager didn't get text
            if (!fetchedContent) {
              const fetchHeaders = { ...headers, "Accept": "text/html,application/xhtml+xml,application/xml" };
              const postRes = await axios.get(targetUrl, { headers: fetchHeaders, responseType: 'text', timeout: 10000 });
              const postHtml = postRes.data;

              // Extract true attributed URN (ugcPost or share) if not already known
              if (!targetAttributedUrn) {
                targetAttributedUrn = resolveAttributedUrnFromHtml(postHtml, activityId);
              }

              // Parse HTML with mapUrnsToTexts
              const htmlMap = mapUrnsToTexts(postHtml);
              if (htmlMap[activityId] && htmlMap[activityId].length > 15) {
                postText = htmlMap[activityId];
                fetchedContent = true;
              } else {
                const ogMatch = postHtml.match(/<meta property="og:description"\s+content="([^"]+)"/i) || postHtml.match(/<meta property='og:description'\s+content='([^']+)'/i) || postHtml.match(/<meta name="description"\s+content="([^"]+)"/i);
                if (ogMatch && ogMatch[1] && !ogMatch[1].includes("Post | LinkedIn") && ogMatch[1].length > 20) {
                  postText = ogMatch[1];
                  fetchedContent = true;
                }
              }

              // Deep regex scan if still not resolved
              if (!fetchedContent) {
                let possibleTexts = [];
                const rawMatches = postHtml.matchAll(/"text":"(.*?)"/g);
                for (const m of rawMatches) {
                  if (m[1].length > 30 && !m[1].includes("urn:li:") && !m[1].includes("Post | LinkedIn")) {
                    possibleTexts.push(m[1]);
                  }
                }
                const escMatches = postHtml.matchAll(/&quot;text&quot;:&quot;(.*?)&quot;/g);
                for (const m of escMatches) {
                  if (m[1].length > 30 && !m[1].includes("urn:li:") && !m[1].includes("Post | LinkedIn")) {
                    possibleTexts.push(m[1]);
                  }
                }
                if (possibleTexts.length > 0) {
                  possibleTexts.sort((a, b) => b.length - a.length);
                  postText = possibleTexts[0].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                  fetchedContent = true;
                }
              }
            }
          } catch (e) {
            await logger.append("WARN", `Could not fetch post HTML for context: ${e.message}`);
          }
        }

        // Clean up entities
        if (postText) {
          postText = postText.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }

        // 3. Fallback Topic Context: If postText is still generic "Post | LinkedIn", short, or empty, use keyword topic context so AI does not skip
        if (!postText || postText.includes("Post | LinkedIn") || postText === "LinkedIn" || postText.trim().length < 15) {
          const topic = keywordUsed ? `the topic of "${keywordUsed}"` : "professional achievements, networking, and industry insights";
          postText = `A trending LinkedIn post discussing ${topic} and shared career experiences.`;
          await logger.append("INFO", `Applied topic fallback context for AI: "${postText}"`);
        }
        
        try {
          await logger.append("INFO", `Post context extracted: ${postText.substring(0, 100)}...`);
          const aiResponse = await generateAiComment(aiProvider, aiApiKey, promptTemplate, postText);
          if (aiResponse && aiResponse.skip) {
            skipReason = aiResponse.reason || "AI chose to skip.";
            await logger.append("WARN", `AI skipped: ${skipReason}`);
          } else if (aiResponse && aiResponse.comment) {
            commentText = aiResponse.comment;
          } else {
            await logger.append("WARN", `Invalid AI response: ${JSON.stringify(aiResponse)}`);
            continue;
          }
        } catch (err) {
          const apiErrorDetail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
          await logger.append("ERROR", `AI error: ${apiErrorDetail} (Provider: ${aiProvider})`);
          continue;
        }

        if (skipReason) {
          // Log skip
          await supabase.from("automailsend_linkedin_comments_log").insert({
            user_id: userId,
            post_url: targetUrl,
            comment_text: "SKIPPED",
            status: "failed",
            error_message: skipReason,
            sent_at: new Date().toISOString()
          });
          commentedUrls.add(targetUrl);
          continue;
        }

        await logger.append("INFO", `Attempting to post comment: "${commentText}"`);

        // Headers are already parsed above

        let success = false;
        let apiError = null;

        // Resolve attributed URN on-demand from post HTML if not already known
        if (!targetAttributedUrn) {
          try {
            const fetchHeaders = { ...headers, "Accept": "text/html,application/xhtml+xml,application/xml" };
            const postRes = await axios.get(targetUrl, { headers: fetchHeaders, responseType: 'text', timeout: 8000 });
            targetAttributedUrn = resolveAttributedUrnFromHtml(postRes.data, activityId);
            if (targetAttributedUrn) {
              await logger.append("INFO", `Resolved attributed URN before posting: ${targetAttributedUrn}`);
            }
          } catch (e) {}
        }

        // Target URN candidates in prioritized order
        const targetUrns = [];
        if (targetAttributedUrn) {
          targetUrns.push(targetAttributedUrn);
        }
        targetUrns.push(activityUrn);

        try {
          if (linkedinAuth && linkedinAuth.access_token && linkedinAuth.linkedin_person_urn) {
            console.log(`[DEBUG] Using Official LinkedIn OAuth API for commenting.`);
            
            // Official API strictly requires urn:li:share or urn:li:ugcPost
            const oauthUrns = targetUrns.filter(u => u.startsWith('urn:li:share:') || u.startsWith('urn:li:ugcPost:'));
            if (oauthUrns.length === 0) {
              oauthUrns.push(`urn:li:share:${activityId}`, `urn:li:ugcPost:${activityId}`);
            }

            let oauthSuccess = false;
            let oauthErrText = '';
            let oauthStatus = 0;

            for (const urn of oauthUrns) {
              const oauthUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/comments`;
              const oauthRes = await fetch(oauthUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${linkedinAuth.access_token}`,
                  'Content-Type': 'application/json',
                  'X-Restli-Protocol-Version': '2.0.0'
                },
                body: JSON.stringify({
                  actor: linkedinAuth.linkedin_person_urn,
                  message: { text: commentText }
                })
              });

              if (oauthRes.ok) {
                oauthSuccess = true;
                break;
              } else {
                oauthErrText = await oauthRes.text();
                oauthStatus = oauthRes.status;
                if (oauthStatus !== 404 && oauthStatus !== 400) {
                  break;
                }
              }
            }

            if (!oauthSuccess) {
              throw { response: { status: oauthStatus, data: oauthErrText }, message: `OAuth API failed with status ${oauthStatus}` };
            }
            success = true;
          } else {
            console.log(`[DEBUG] No OAuth token found. Falling back to Voyager API.`);
            const dashHeaders = {
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
              'x-restli-protocol-version': '2.0.0',
              'content-type': 'application/json; charset=UTF-8'
            };

            for (const key of Object.keys(headers)) {
              const lkey = key.toLowerCase();
              if (['cookie', 'csrf-token', 'user-agent', 'referer', 'origin'].includes(lkey)) {
                dashHeaders[lkey] = headers[key];
              }
            }

            console.log(`[DEBUG] Sending Comment Request using fetch(). Candidates: ${targetUrns.join(', ')}`);
            const dashUrl = process.env.LINKEDIN_COMMENT_DASH_URL || `https://www.linkedin.com/voyager/api/voyagerSocialDashNormComments`;
            let lastErr = null;

            // 1. Try Voyager Dash Norm Comments with candidate URNs
            for (const urn of targetUrns) {
              try {
                const dashRes = await fetch(dashUrl, {
                  method: 'POST',
                  headers: dashHeaders,
                  body: JSON.stringify({
                    objectUrn: urn,
                    threadUrn: urn,
                    comment: {
                      text: commentText,
                      attributesV2: [],
                      $type: "com.linkedin.voyager.dash.common.text.TextViewModel"
                    }
                  })
                });

                if (dashRes.ok) {
                  success = true;
                  break;
                } else {
                  const errText = await dashRes.text();
                  lastErr = { status: dashRes.status, data: errText };
                  console.log(`[DEBUG] Dash norm comments failed for ${urn} with status ${dashRes.status}: ${errText}`);
                }
              } catch (e) {
                lastErr = { status: 0, data: e.message };
              }
            }

            // 2. If Dash Norm Comments failed, try fallback feed/comments endpoint
            if (!success) {
              const fallbackUrl = process.env.LINKEDIN_COMMENT_FALLBACK_URL || `https://www.linkedin.com/voyager/api/feed/comments?action=create`;
              for (const urn of targetUrns) {
                try {
                  const fbRes = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                      socialDetailEntity: urn,
                      text: commentText
                    })
                  });

                  if (fbRes.ok) {
                    success = true;
                    break;
                  } else {
                    const fbErrText = await fbRes.text();
                    lastErr = { status: fbRes.status, data: fbErrText };
                    console.log(`[DEBUG] Fallback comments failed for ${urn} with status ${fbRes.status}: ${fbErrText}`);
                  }
                } catch (fbErr) {
                  lastErr = { status: 0, data: fbErr.message };
                }
              }
            }

            if (!success) {
              const errPayload = lastErr?.data || `Status ${lastErr?.status || 400}`;
              throw { response: { status: lastErr?.status || 400, data: errPayload }, message: errPayload };
            }
          }
        } catch (err) {
          const rawData = err.response?.data;
          const dataStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData || {});
          apiError = (dataStr && dataStr !== '""' && dataStr !== '{}') ? dataStr : err.message;
          console.log(`[DEBUG] Comment posting failed: ${err.message}. Response: ${dataStr}`);
        }

        if (success) {
          await logger.append("SUCCESS", `Comment posted successfully on ${targetUrl}`);
          await supabase.from("automailsend_linkedin_comments_log").insert({
            user_id: userId,
            post_url: targetUrl,
            comment_text: commentText,
            status: "sent",
            sent_at: new Date().toISOString()
          });
          sentCount++;
          commentedUrls.add(targetUrl);
          
          await logger.append("INFO", `Comment successful. Halting further comments for this user until next allowed interval.`);
          break; // Exit the loop so we don't hold the server backend; the cron will pick it up later!
        } else {
          await logger.append("ERROR", `Failed to post comment: ${apiError}`);
          await supabase.from("automailsend_linkedin_comments_log").insert({
            user_id: userId,
            post_url: targetUrl,
            comment_text: commentText,
            status: "failed",
            error_message: apiError,
            sent_at: new Date().toISOString()
          });
          commentedUrls.add(targetUrl);
        }
      }
      
      await logger.finish("success", `Finished Auto-Comment batch. Sent: ${sentCount}`);
    }
  } catch (err) {
    console.error(pc.red("[AutoComment Worker] Global error: " + err.message));
  }
}

module.exports = { runAutoCommentJobs };
