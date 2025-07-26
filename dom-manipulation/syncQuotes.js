import {
  fetchQuotesFromServer,
  createQuoteOnServer,
  updateQuoteOnServer,
  checkServerHealth,
  processQueuedRequests,
} from "./fetchQuotes.js";
import {
  showNotification,
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showLoadingNotification,
  removeNotification,
} from "./notifications.js";

let syncInProgress = false;
let syncInterval = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

function getLocalQuotes() {
  try {
    const quotes = JSON.parse(localStorage.getItem("savedQuotes")) || [];
    if (!Array.isArray(quotes)) {
      console.warn("Invalid quotes format in localStorage, resetting");
      localStorage.setItem("savedQuotes", JSON.stringify([]));
      return [];
    }
    return quotes;
  } catch (error) {
    console.error("Failed to parse localStorage quotes:", error);
    showErrorNotification(
      "Local storage data corrupted. Resetting to empty state."
    );
    localStorage.setItem("savedQuotes", JSON.stringify([]));
    return [];
  }
}

function validateQuote(quote) {
  return (
    quote &&
    typeof quote.id === "string" &&
    typeof quote.text === "string" &&
    quote.text.trim().length > 0 &&
    typeof quote.category === "string" &&
    quote.category.trim().length > 0
  );
}

function normalizeQuote(quote) {
  return {
    ...quote,
    text: quote.text.trim(),
    category: quote.category.trim(),
    author: (quote.author || "Unknown").trim(),
    editable: Boolean(quote.editable),
  };
}

function mergeQuotes(localQuotes, serverQuotes) {
  const mergedQuotes = [];
  const serverQuoteIDs = new Set(serverQuotes.map((quote) => quote.id));
  const conflicts = [];

  // Validate and normalize all quotes
  const validLocalQuotes = localQuotes
    .filter(validateQuote)
    .map(normalizeQuote);
  const validServerQuotes = serverQuotes
    .filter(validateQuote)
    .map(normalizeQuote);

  // Process server quotes first (server wins by default)
  validServerQuotes.forEach((serverQuote) => {
    const localQuote = validLocalQuotes.find(
      (quote) => quote.id === serverQuote.id
    );

    if (localQuote) {
      // Check for conflicts
      const hasTextConflict = localQuote.text !== serverQuote.text;
      const hasCategoryConflict = localQuote.category !== serverQuote.category;
      const hasAuthorConflict = localQuote.author !== serverQuote.author;

      if (hasTextConflict || hasCategoryConflict || hasAuthorConflict) {
        conflicts.push({
          id: serverQuote.id,
          local: localQuote,
          server: serverQuote,
          conflicts: {
            text: hasTextConflict,
            category: hasCategoryConflict,
            author: hasAuthorConflict,
          },
        });
      }

      // Server wins in conflicts
      mergedQuotes.push(serverQuote);
    } else {
      mergedQuotes.push(serverQuote);
    }
  });

  // Add local-only quotes
  validLocalQuotes.forEach((localQuote) => {
    if (!serverQuoteIDs.has(localQuote.id)) {
      mergedQuotes.push(localQuote);
    }
  });

  return { mergedQuotes, conflicts };
}

async function exponentialBackoff(attempt) {
  const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function syncQuotes(showLoadingIndicator = true) {
  if (syncInProgress) {
    showWarningNotification("Sync already in progress");
    return { success: false, reason: "already_in_progress" };
  }

  syncInProgress = true;
  let loadingNotificationId = null;

  if (showLoadingIndicator) {
    loadingNotificationId = showLoadingNotification("Syncing quotes");
  }

  try {
    // Check server health first
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
      throw new Error("Server is not available");
    }

    // Fetch server quotes with validation
    const serverQuotes = await fetchQuotesFromServer();
    if (!Array.isArray(serverQuotes)) {
      throw new Error("Invalid server response format");
    }

    const localQuotes = getLocalQuotes();
    const { mergedQuotes, conflicts } = mergeQuotes(localQuotes, serverQuotes);

    // Update local storage with merged data
    localStorage.setItem("savedQuotes", JSON.stringify(mergedQuotes));

    // Handle conflicts
    if (conflicts.length > 0) {
      showConflictNotification(conflicts);
    }

    // Push local-only quotes to server
    const localOnlyQuotes = localQuotes.filter(
      (localQuote) =>
        !serverQuotes.some((serverQuote) => serverQuote.id === localQuote.id)
    );

    if (localOnlyQuotes.length > 0) {
      const pushResults = await Promise.allSettled(
        localOnlyQuotes.map((quote) => createQuoteOnServer(quote))
      );

      const failedPushes = pushResults.filter(
        (result) => result.status === "rejected"
      );
      if (failedPushes.length > 0) {
        showWarningNotification(
          `${failedPushes.length} quotes failed to sync to server. They will be retried later.`
        );
      }
    }

    // Process any queued requests
    await processQueuedRequests();

    // Dispatch update event
    document.dispatchEvent(
      new CustomEvent("quotesUpdated", {
        detail: {
          mergedCount: mergedQuotes.length,
          conflictCount: conflicts.length,
          pushedCount: localOnlyQuotes.length,
        },
      })
    );

    retryCount = 0; // Reset retry count on success

    if (loadingNotificationId) {
      removeNotification(loadingNotificationId);
    }

    showSuccessNotification(
      `Sync completed! ${mergedQuotes.length} quotes available` +
        (conflicts.length > 0
          ? ` (${conflicts.length} conflicts resolved)`
          : "")
    );

    return {
      success: true,
      mergedCount: mergedQuotes.length,
      conflictCount: conflicts.length,
    };
  } catch (error) {
    console.error("Sync failed:", error);

    if (loadingNotificationId) {
      removeNotification(loadingNotificationId);
    }

    retryCount++;

    if (retryCount <= MAX_RETRIES) {
      showWarningNotification(
        `Sync failed (attempt ${retryCount}/${MAX_RETRIES}). Retrying in ${Math.pow(
          2,
          retryCount
        )} seconds...`
      );

      setTimeout(async () => {
        await exponentialBackoff(retryCount - 1);
        syncQuotes(false); // Retry without loading indicator
      }, BASE_RETRY_DELAY);
    } else {
      showErrorNotification(
        `Sync failed after ${MAX_RETRIES} attempts. Working in offline mode.`
      );
      retryCount = 0; // Reset for next manual sync attempt
    }

    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

function showConflictNotification(conflicts) {
  const conflictMessage = `Found ${conflicts.length} conflict${
    conflicts.length > 1 ? "s" : ""
  } during sync. Server data was applied. <button class="review-conflicts" style="background: #0079fe; color: white; border: none; padding: 4px 8px; border-radius: 3px; margin-left: 8px; cursor: pointer;">Review</button>`;

  showNotification(conflictMessage, 10000, "warning");

  // Add event listener for review button
  setTimeout(() => {
    document.querySelectorAll(".review-conflicts").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          showConflictResolutionModal(conflicts);
        },
        { once: true }
      );
    });
  }, 100);
}

function showConflictResolutionModal(conflicts) {
  // Remove existing modal if present
  const existingModal = document.querySelector(".conflict-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "conflict-modal";
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;

  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
        background: #1f2a48;
        padding: 2em;
        border-radius: 10px;
        color: white;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;

  let contentHTML = `
        <h2>Sync Conflicts Resolved</h2>
        <p>The following conflicts were detected and resolved automatically (server data was kept):</p>
    `;

  conflicts.forEach((conflict, index) => {
    const conflictTypes = [];
    if (conflict.conflicts.text) conflictTypes.push("text");
    if (conflict.conflicts.category) conflictTypes.push("category");
    if (conflict.conflicts.author) conflictTypes.push("author");

    contentHTML += `
            <div class="conflict" style="margin: 1.5em 0; padding: 1em; background: rgba(255,255,255,0.1); border-radius: 5px;">
                <h3>Quote #${conflict.id}</h3>
                <p><strong>Conflicts in:</strong> ${conflictTypes.join(
                  ", "
                )}</p>
                <div style="margin: 0.5em 0;">
                    <strong>Current (Server) Version:</strong><br>
                    "${conflict.server.text}" <br>
                    <em>by ${conflict.server.author} (${
      conflict.server.category
    })</em>
                </div>
                <div style="margin: 0.5em 0; opacity: 0.7;">
                    <strong>Local Version (overwritten):</strong><br>
                    "${conflict.local.text}" <br>
                    <em>by ${conflict.local.author} (${
      conflict.local.category
    })</em>
                </div>
            </div>
        `;
  });

  contentHTML += `
        <div style="margin-top: 2em; text-align: center;">
            <button class="close-modal" style="background: #0079fe; color: white; border: none; padding: 0.8em 1.5em; border-radius: 5px; cursor: pointer; font-size: 1em;">
                Close
            </button>
        </div>
    `;

  modalContent.innerHTML = contentHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close modal handlers
  const closeModal = () => modal.remove();

  modal.querySelector(".close-modal").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC key to close
  const escHandler = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
}

// Auto-sync functionality with better error handling
export function startAutoSync(intervalMinutes = 5) {
  stopAutoSync(); // Clear any existing interval

  syncInterval = setInterval(async () => {
    const result = await syncQuotes(false); // Auto-sync without loading indicator

    if (!result.success && result.reason !== "already_in_progress") {
      console.warn("Auto-sync failed:", result.error);
    }
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Initialize auto-sync when module loads
document.addEventListener("DOMContentLoaded", () => {
  // Initial sync
  setTimeout(() => syncQuotes(), 1000);

  // Start auto-sync every 5 minutes
  startAutoSync(5);
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  stopAutoSync();
});
