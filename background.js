chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("http")) {
    console.warn("Page not support script.");
    return;
  }

  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.designMode,
    });

    const mode = res.result;
    const newMode = mode === "on" ? "off" : "on";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (val) => {
        document.designMode = val;
      },
      args: [newMode],
    });

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

    chrome.action.setIcon({
      tabId: tab.id,
      path: iconPath,
    });

    console.log("Toggled designMode to:", newMode);
  } catch (error) {
    console.error("Error toggle designMode:", error);
  }
});
