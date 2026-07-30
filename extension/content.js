// Inject a marker into the page so the Automail web app knows the extension is installed
const marker = document.createElement("meta");
marker.name = "automail-extension-installed";
marker.content = "true";
document.head.appendChild(marker);

// Listen for a custom event dispatched by the Automail web app
window.addEventListener("AUTOMAILEXT_REQUEST_COOKIE", () => {
  // Ask the background script to fetch the cookie
  chrome.runtime.sendMessage({ action: "getLinkedInCookie" }, (response) => {
    // Dispatch a response custom event back to the web app
    const event = new CustomEvent("AUTOMAILEXT_RECEIVE_COOKIE", {
      detail: response
    });
    window.dispatchEvent(event);
  });
});
