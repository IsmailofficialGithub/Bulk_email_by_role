chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLinkedInCookie") {
    chrome.cookies.get({ url: "https://www.linkedin.com", name: "JSESSIONID" }, (jsessionidCookie) => {
      chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" }, (liAtCookie) => {
        if (jsessionidCookie && liAtCookie) {
          const jsessionid = jsessionidCookie.value.replace(/"/g, '');
          const li_at = liAtCookie.value;
          
          fetch("https://www.linkedin.com/voyager/api/me", {
            headers: {
              "csrf-token": jsessionid,
              "accept": "application/json",
              "x-restli-protocol-version": "2.0.0"
            }
          })
          .then(res => res.json())
          .then(data => {
            let username = "LinkedIn User";
            if (data && data.miniProfile) {
              username = `${data.miniProfile.firstName} ${data.miniProfile.lastName}`;
            }
            sendResponse({ success: true, jsessionid, li_at, username });
          })
          .catch(() => {
            sendResponse({ success: true, jsessionid, li_at, username: "LinkedIn User" });
          });
        } else {
          sendResponse({ success: false, error: "Not logged in to LinkedIn or cookies missing." });
        }
      });
    });
    return true;
  }
});
