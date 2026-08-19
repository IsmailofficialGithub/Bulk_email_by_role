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
  
  const codeBlocks = rawString.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
  for (const block of codeBlocks) {
    const content = block.replace(/<code[^>]*>/i, '').replace(/<\/code>/i, '').trim();
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
  
  try {
    jsonBlocks.push(JSON.parse(rawString));
  } catch (e) {}
  
  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
      return;
    }
    
    let urn = null;
    if (typeof obj.urn === "string" && obj.urn.includes("urn:li:activity:")) {
      urn = obj.urn;
    } else if (obj.updateMetadata && typeof obj.updateMetadata.urn === "string" && obj.updateMetadata.urn.includes("urn:li:activity:")) {
      urn = obj.updateMetadata.urn;
    }
    
    if (urn) {
      const activityId = urn.match(/urn:li:activity:(\d{19})/)?.[1];
      if (activityId) {
        let text = "";
        if (obj.commentary && obj.commentary.text && typeof obj.commentary.text.text === "string") {
          text = obj.commentary.text.text;
        } else if (obj.updateMetadata && obj.updateMetadata.commentary && typeof obj.updateMetadata.commentary.text === "string") {
          text = obj.updateMetadata.commentary.text;
        }
        if (text) {
          urnToText[activityId] = text;
        }
      }
    }
    
    for (const key of Object.keys(obj)) {
      traverse(obj[key]);
    }
  }
  
  jsonBlocks.forEach(traverse);
  return urnToText;
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
        // Assume URN is activity. Can also be ugcPost.
        const activityUrn = `urn:li:activity:${activityId}`;

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
        let postText = "A LinkedIn post";
        
        if (urnToTextMap && urnToTextMap[activityId]) {
          postText = urnToTextMap[activityId];
          await logger.append("INFO", `Using pre-extracted post content from feed.`);
        } else {
          try {
            await logger.append("INFO", `Fetching post content for AI context...`);
            // Use the authenticated headers, but modify accept for HTML
            const fetchHeaders = { ...headers, "Accept": "text/html,application/xhtml+xml,application/xml" };
            const postRes = await axios.get(targetUrl, { headers: fetchHeaders, responseType: 'text' });
            const postHtml = postRes.data;
            
            const ogMatch = postHtml.match(/<meta property="og:description"\s+content="([^"]+)"/i) || postHtml.match(/<meta property='og:description'\s+content='([^']+)'/i) || postHtml.match(/<meta name="description"\s+content="([^"]+)"/i);
            if (ogMatch) {
              postText = ogMatch[1];
            } else {
              const titleMatch = postHtml.match(/<title>([^<]+)<\/title>/i);
              if (titleMatch) postText = titleMatch[1];
            }
            
            // Decode HTML entities if needed
            postText = postText.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            
            // If LinkedIn puts generic "Post | LinkedIn", dig into the JSON state payload for the real post text
            if (postText.includes("Post | LinkedIn") || postText === "LinkedIn" || postText.length < 25) {
               let possibleTexts = [];
               
               // Match unescaped JSON text fields
               const rawMatches = postHtml.matchAll(/"text":"(.*?)"/g);
               for (const m of rawMatches) {
                   if (m[1].length > 30 && !m[1].includes("urn:li:")) possibleTexts.push(m[1]);
               }
               
               // Match escaped JSON text fields
               const escMatches = postHtml.matchAll(/&quot;text&quot;:&quot;(.*?)&quot;/g);
               for (const m of escMatches) {
                   if (m[1].length > 30 && !m[1].includes("urn:li:")) possibleTexts.push(m[1]);
               }
               
               if (possibleTexts.length > 0) {
                   // The longest text block in the payload is almost always the main post text
                   possibleTexts.sort((a, b) => b.length - a.length);
                   postText = possibleTexts[0];
               }
               
               // Final clean up of escaped json chars
               postText = postText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
          } catch (e) {
            await logger.append("WARN", `Could not fetch post HTML for context: ${e.message}`);
          }
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

        try {
          if (linkedinAuth && linkedinAuth.access_token && linkedinAuth.linkedin_person_urn) {
            console.log(`[DEBUG] Using Official LinkedIn OAuth API for commenting.`);
            
            // The Official API requires urn:li:share or urn:li:ugcPost, NOT urn:li:activity
            const possibleUrns = [];
            if (targetUrl.includes('-share-')) possibleUrns.push(`urn:li:share:${activityId}`);
            if (targetUrl.includes('-ugcPost-')) possibleUrns.push(`urn:li:ugcPost:${activityId}`);
            // Fallbacks just in case
            possibleUrns.push(`urn:li:activity:${activityId}`);
            if (possibleUrns.length === 1 || !targetUrl.includes('-share-')) possibleUrns.push(`urn:li:share:${activityId}`);
            if (possibleUrns.length === 2 || !targetUrl.includes('-ugcPost-')) possibleUrns.push(`urn:li:ugcPost:${activityId}`);

            let oauthSuccess = false;
            let oauthErrText = '';
            let oauthStatus = 0;

            for (const urn of possibleUrns) {
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
                if (oauthStatus !== 404) {
                  // If it's a 400 or 401, don't keep trying URNs
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

            console.log(`[DEBUG] Sending Comment Request using fetch().`);
            const dashUrl = process.env.LINKEDIN_COMMENT_DASH_URL || `https://www.linkedin.com/voyager/api/voyagerSocialDashNormComments`;
            
            const dashRes = await fetch(dashUrl, {
              method: 'POST',
              headers: dashHeaders,
              body: JSON.stringify({
                objectUrn: activityUrn,
                threadUrn: activityUrn,
                comment: {
                  text: commentText,
                  attributesV2: [],
                  $type: "com.linkedin.voyager.dash.common.text.TextViewModel"
                }
              })
            });

            if (!dashRes.ok) {
              const errText = await dashRes.text();
              throw { response: { status: dashRes.status, data: errText }, message: `Voyager API failed with status ${dashRes.status}` };
            }
            success = true;
          }
        } catch (err) {
          console.log(`[DEBUG] First request failed: ${err.message}. Status: ${err.response?.status}`);
          // Sometimes it's urn:li:ugcPost or the older endpoint (only if Voyager was used, or we just try anyway)
          try {
            const fallbackUrl = process.env.LINKEDIN_COMMENT_FALLBACK_URL || `https://www.linkedin.com/voyager/api/feed/comments?action=create`;
            const fbRes = await fetch(fallbackUrl, {
              method: 'POST',
              headers: headers, // Use full headers for generic fallback
              body: JSON.stringify({
                socialDetailEntity: activityUrn,
                text: commentText
              })
            });
            if (!fbRes.ok) throw { response: { data: await fbRes.text() }, message: `Fallback status ${fbRes.status}` };
            success = true;
          } catch (err2) {
            try {
              // UGC URN fallback
              const ugcUrn = `urn:li:ugcPost:${activityId}`;
              const fallbackUrl = process.env.LINKEDIN_COMMENT_FALLBACK_URL || `https://www.linkedin.com/voyager/api/feed/comments?action=create`;
              const fbRes2 = await fetch(fallbackUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                  socialDetailEntity: ugcUrn,
                  text: commentText
                })
              });
              if (!fbRes2.ok) throw { response: { data: await fbRes2.text() }, message: `Fallback 2 status ${fbRes2.status}` };
              success = true;
            } catch (err3) {
              const dataStr = typeof err3.response?.data === 'string' ? err3.response.data : JSON.stringify(err3.response?.data);
              const origDataStr = typeof err.response?.data === 'string' ? err.response.data : JSON.stringify(err.response?.data);
              apiError = (dataStr && dataStr !== '""') ? dataStr : ((origDataStr && origDataStr !== '""') ? origDataStr : err3.message);
              console.log(`[DEBUG] Fallback failed: ${err3.message}. Response: ${dataStr}`);
            }
          }
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
