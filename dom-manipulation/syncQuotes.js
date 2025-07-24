import { fetchQuotesFromServer, createQuoteOnServer, updateQuoteOnServer, serverURL } from "./fetchQuotes.js";
import { showNotification } from "./notification.js";

// Function to safely parse localStorage quotes
function getLocalQuotes() {
    try {
        const quotes = JSON.parse(localStorage.getItem("savedQuotes")) || [];
        return Array.isArray(quotes) ? quotes : [];
    } catch (error) {
        console.error("Failed to parse localStorage quotes:", error);
        showNotification("Local storage data corrupted. Resetting to empty state.", 5000);
        localStorage.setItem("savedQuotes", JSON.stringify([]));
        return [];
    }
}

// Merge local and server quotes, handling duplicates and conflicts
function mergeQuotes(localQuotes, serverQuotes) {
    const mergedQuotes = [];
    const serverQuoteIds = new Set(serverQuotes.map((q) => q.id));
    const conflicts = [];

    // Process server quotes first (server precedence)
    serverQuotes.forEach((serverQuote) => {
        const localQuote = localQuotes.find((q) => q.id === serverQuote.id);
        if (localQuote) {
            // Check for content differences
            if (
                localQuote.text !== serverQuote.text ||
                localQuote.category !== serverQuote.category ||
                localQuote.author !== serverQuote.author
            ) {
                conflicts.push({ id: serverQuote.id, local: localQuote, server: serverQuote });
                mergedQuotes.push(serverQuote); // Server wins by default
            } else {
                mergedQuotes.push(serverQuote);
            }
        } else {
            mergedQuotes.push(serverQuote); // New server quote
        }
    });

    // Add local quotes not on server
    localQuotes.forEach((localQuote) => {
        if (!serverQuoteIds.has(localQuote.id)) {
            mergedQuotes.push(localQuote);
        }
    });

    return { mergedQuotes, conflicts };
}

// Main sync function with retry mechanism
export async function syncQuotes(maxRetries = 3, retryDelay = 60000) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            // Fetch server quotes
            const serverQuotes = await fetchQuotesFromServer();
            if (!Array.isArray(serverQuotes)) {
                throw new Error("Server returned invalid data");
            }

            // Get local quotes
            const localQuotes = getLocalQuotes();

            // Merge quotes and detect conflicts
            const { mergedQuotes, conflicts } = mergeQuotes(localQuotes, serverQuotes);

            // Save merged quotes to localStorage
            localStorage.setItem("savedQuotes", JSON.stringify(mergedQuotes));

            // Handle conflicts
            if (conflicts.length > 0) {
                showNotification(
                    `Detected ${conflicts.length} conflicts. Server data applied. <button id="review-conflicts">Review</button>`,
                    10000
                );

                // Add event listener for conflict review (single-use to avoid duplicates)
                const reviewButton = document.getElementById("review-conflicts");
                if (reviewButton) {
                    reviewButton.addEventListener(
                        "click",
                        () => {
                            showConflictResolutionModal(conflicts);
                        },
                        { once: true }
                    );
                }
            }

            // Push local-only quotes to server
            for (const quote of localQuotes) {
                if (!serverQuotes.some((sq) => sq.id === quote.id)) {
                    try {
                        await createQuoteOnServer(quote);
                    } catch (error) {
                        console.error(`Failed to push quote ${quote.id} to server:`, error);
                        showNotification(`Failed to sync quote: ${quote.text.slice(0, 20)}...`, 5000);
                    }
                }
            }

            // Trigger UI refresh
            document.dispatchEvent(new Event("quotesUpdated"));

            // Schedule next sync
            setTimeout(() => syncQuotes(maxRetries, retryDelay), 30000);
            return;
        } catch (error) {
            attempt++;
            console.error(`Sync attempt ${attempt} failed:`, error);
            if (attempt < maxRetries) {
                showNotification(`Sync attempt ${attempt} failed. Retrying in ${retryDelay / 1000} seconds...`, 5000);
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
                showNotification("Failed to sync quotes after multiple attempts.", 10000);
                // Schedule next sync despite failure to prevent stalling
                setTimeout(() => syncQuotes(maxRetries, retryDelay), retryDelay * 2);
            }
        }
    }
}

// Show conflict resolution modal
function showConflictResolutionModal(conflicts) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1f2a48;
        padding: 2em;
        border-radius: 10px;
        color: white;
        z-index: 1000;
        max-width: 500px;
        width: 90%;
    `;

    let modalContent = "<h2>Resolve Conflicts</h2>";
    conflicts.forEach((conflict) => {
        modalContent += `
            <div class="conflict">
                <h3>Quote ID: ${conflict.id}</h3>
                <p><strong>Local:</strong> ${conflict.local.text} (Category: ${conflict.local.category}, Author: ${conflict.local.author || "Unknown"})</p>
                <p><strong>Server:</strong> ${conflict.server.text} (Category: ${conflict.server.category}, Author: ${conflict.server.author || "Unknown"})</p>
                <button onclick="window.acceptServerQuote('${conflict.id}')">Accept Server</button>
                <button onclick="window.acceptLocalQuote('${conflict.id}')">Accept Local</button>
            </div>
        `;
    });

    modalContent += '<button onclick="this.parentElement.remove()">Close</button>';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    // Global functions for conflict resolution
    window.acceptServerQuote = async (id) => {
        const quote = conflicts.find((c) => c.id === id).server;
        try {
            await updateQuoteOnServer(id, quote);
            showNotification(`Quote ${id} updated with server data.`, 5000);
            modal.remove();
            document.dispatchEvent(new Event("quotesUpdated"));
        } catch (error) {
            console.error(`Failed to update quote ${id}:`, error);
            showNotification(`Failed to update quote ${id}.`, 5000);
        }
    };

    window.acceptLocalQuote = async (id) => {
        const quote = conflicts.find((c) => c.id === id).local;
        try {
            await updateQuoteOnServer(id, quote);
            const updatedQuotes = getLocalQuotes().map((q) => (q.id === id ? quote : q));
            localStorage.setItem("savedQuotes", JSON.stringify(updatedQuotes));
            showNotification(`Quote ${id} updated with local data.`, 5000);
            modal.remove();
            document.dispatchEvent(new Event("quotesUpdated"));
        } catch (error) {
            console.error(`Failed to update quote ${id}:`, error);
            showNotification(`Failed to update quote ${id}.`, 5000);
        }
    };
}

// Start periodic sync on page load
document.addEventListener("DOMContentLoaded", () => {
    syncQuotes();
});
