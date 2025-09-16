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
      target: { tabId: tab.id, allFrames: true },
      func: (val) => {
        // events from mouse, keyboard to website
        const events = [
          "click",
          "mousedown",
          "mouseup",
          "touchstart",
          "touchend",
          "keydown",
          "keypress",
          "keyup",
        ];

        if (val === "on") {
          document.designMode = "on";

          // Central backup store for this page while edit mode is ON
          window.__editToggleState = {
            editableBackup: new WeakMap(),
            attrBackup: new WeakMap(),
            styleBackup: new WeakMap(),
          };

          // Helper: apply to element and optionally its shadow tree
          const traverse = (root) => {
            const all = root.querySelectorAll("*");
            all.forEach((el) => {
              // Backup and force contentEditable
              window.__editToggleState.editableBackup.set(
                el,
                el.contentEditable
              );
              el.contentEditable = "true";

              // For form controls: remove readonly/disabled while ON
              if (
                el instanceof HTMLInputElement ||
                el instanceof HTMLTextAreaElement ||
                el instanceof HTMLSelectElement
              ) {
                const backup = {
                  readOnly: /** @type {any} */ (el).readOnly ?? false,
                  disabled: el.disabled ?? false,
                };
                window.__editToggleState.attrBackup.set(el, backup);
                // Enable editing
                if ("readOnly" in el) {
                  /** @type {any} */ (el).readOnly = false;
                }
                el.disabled = false;
              }

              // Temporarily remove inert attribute (blocks interaction)
              if (el.hasAttribute && el.hasAttribute("inert")) {
                const inertBackup =
                  window.__editToggleState.attrBackup.get(el) || {};
                inertBackup.inert = true;
                window.__editToggleState.attrBackup.set(el, inertBackup);
                el.removeAttribute("inert");
              }

              // Ensure text selection and pointer events are enabled
              const styleBackup = {
                userSelect: el.style.userSelect,
                webkitUserSelect: el.style.webkitUserSelect,
                pointerEvents: el.style.pointerEvents,
              };
              window.__editToggleState.styleBackup.set(el, styleBackup);
              el.style.userSelect = "text";
              el.style.webkitUserSelect = "text";
              el.style.pointerEvents = "auto";

              // Recurse into shadow DOM if present
              if (el.shadowRoot) {
                traverse(el.shadowRoot);
              }
            });
          };

          traverse(document);

          // Block user interaction events
          window.__blockEventHandlers = [];
          events.forEach((evt) => {
            const handler = (e) => e.stopImmediatePropagation();
            document.addEventListener(evt, handler, true);
            window.__blockEventHandlers.push({ evt, handler });
          });
        } else {
          document.designMode = "off";

          // Restore original states
          const restoreTree = (root) => {
            const all = root.querySelectorAll("*");
            all.forEach((el) => {
              // Restore contentEditable
              if (window.__editToggleState?.editableBackup) {
                const original =
                  window.__editToggleState.editableBackup.get(el);
                if (original !== undefined) {
                  el.contentEditable = original;
                } else {
                  el.removeAttribute("contentEditable");
                }
              }

              // Restore readonly/disabled for form controls
              if (window.__editToggleState?.attrBackup) {
                const attr = window.__editToggleState.attrBackup.get(el);
                if (attr) {
                  if ("readOnly" in el) {
                    /** @type {any} */ (el).readOnly = attr.readOnly;
                  }
                  el.disabled = attr.disabled;
                  if (attr.inert) {
                    el.setAttribute("inert", "");
                  }
                }
              }

              // Restore styles
              if (window.__editToggleState?.styleBackup) {
                const styleB = window.__editToggleState.styleBackup.get(el);
                if (styleB) {
                  el.style.userSelect = styleB.userSelect;
                  el.style.webkitUserSelect = styleB.webkitUserSelect;
                  el.style.pointerEvents = styleB.pointerEvents;
                }
              }

              // Shadow DOM restore
              if (el.shadowRoot) {
                restoreTree(el.shadowRoot);
              }
            });
          };

          restoreTree(document);
          window.__editToggleState = undefined;

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
