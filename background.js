chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("http")) {
    console.warn("Page not supported for script injection.");
    return;
  }

  try {
    // Get current designMode state
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.designMode,
    });

    const mode = res.result;
    const newMode = mode === "on" ? "off" : "on";

    // Inject script to toggle designMode and editing behavior
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (val) => {
        const events = [
          "click",
          "mousedown",
          "mouseup",
          "touchstart",
          "touchend",
        ];

        if (val === "on") {
          document.designMode = "on";

          // Save original contentEditable state
          window.__editableBackup = new WeakMap();
          document.querySelectorAll("*").forEach((el) => {
            window.__editableBackup.set(el, el.contentEditable);
            el.contentEditable = "true";
          });

          // Block user interaction events
          window.__blockEventHandlers = [];
          events.forEach((evt) => {
            const handler = (e) => e.stopImmediatePropagation();
            document.addEventListener(evt, handler, true);
            window.__blockEventHandlers.push({ evt, handler });
          });
        } else {
          document.designMode = "off";

          // Restore original contentEditable state
          if (window.__editableBackup) {
            document.querySelectorAll("*").forEach((el) => {
              const original = window.__editableBackup.get(el);
              if (original !== undefined) {
                el.contentEditable = original;
              } else {
                el.removeAttribute("contentEditable");
              }
            });
          }

          // Unbind blocked events
          if (window.__blockEventHandlers) {
            window.__blockEventHandlers.forEach(({ evt, handler }) => {
              document.removeEventListener(evt, handler, true);
            });
            window.__blockEventHandlers = [];
          }
        }
      },
      args: [newMode],
    });

    // Set icon depending on mode
    const iconPath =
      newMode === "on"
        ? {
            16: "icons/on-16.png",
            32: "icons/on-32.png",
            48: "icons/on-48.png",
            128: "icons/on-128.png",
          }
        : {
            16: "icons/off-16.png",
            32: "icons/off-32.png",
            48: "icons/off-48.png",
            128: "icons/off-128.png",
          };

    chrome.action.setIcon({ tabId: tab.id, path: iconPath });

    console.log("✅ Toggled designMode to:", newMode);
  } catch (error) {
    console.error("❌ Error toggling designMode:", error);
  }
});
