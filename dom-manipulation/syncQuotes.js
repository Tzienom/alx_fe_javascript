import { fetchQuotesFromServer, createQuoteOnServer, updateQuoteOnServer, serverURL } from "./fetchQuotes.js";
import { showNotification } from "./notifications.js";

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

function mergeQuotes(localQuotes, serverQuotes) {
    const mergedQuotes = [];
    const serverQuoteIDs = new Set(serverQuotes.map((quote) => quote.id));
    const conflicts = [];

    serverQuotes.forEach((serverQuote) => {
        const localQuote = localQuotes.find((quote) => quote.id === serverQuote.id);
        if (localQuote) {
            if (
                localQuote.text !== serverQuote.text ||
                localQuote.category !== serverQuote.category ||
                (localQuote.author || "Unknown") !== (serverQuote.author || "Unknown")
            ) {
                conflicts.push({
                    id: serverQuote.id,
                    local: localQuote,
                    server: serverQuote
                });
                mergedQuotes.push(serverQuote);
            } else {
                mergedQuotes.push(serverQuote);
            }
        } else {
            mergedQuotes.push(serverQuote);
        }
    });

    localQuotes.forEach((localQuote) => {
        if (!serverQuoteIDs.has(localQuote.id)) {
            mergedQuotes.push(localQuote);
        }
    });

    return { mergedQuotes, conflicts };
}

export async function syncQuotes(maxRetries = 3, retryDelay = 60000) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const serverQuotes = await fetchQuotesFromServer();
            if (!Array.isArray(serverQuotes)) {
                throw new Error("Server returned invalid data");
            }

            const localQuotes = getLocalQuotes();
            const { mergedQuotes, conflicts } = mergeQuotes(localQuotes, serverQuotes);

            localStorage.setItem("savedQuotes", JSON.stringify(mergedQuotes));

            if (conflicts.length > 0) {
                showNotification(
                    `Detected ${conflicts.length} conflicts. Server data applied. <button class="review-conflicts">Review</button>`,
                    10000
                );

                document.querySelectorAll(".review-conflicts").forEach((button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            showConflictResolutionModal(conflicts);
                        },
                        { once: true }
                    );
                });
            }

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

            document.dispatchEvent(new Event("quotesUpdated"));
            showNotification("Quotes synced successfully!", 5000);

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
                setTimeout(() => syncQuotes(maxRetries, retryDelay), retryDelay * 2);
            }
        }
    }
}

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
        max-width: 500px;
        width: 90%;`;

    let modalContent = "<h2>Resolve Conflicts</h2>";
    conflicts.forEach((conflict) => {
        modalContent += `
            <div class="conflict">
                <h3>Quote ID: ${conflict.id}</h3>
                <p><strong>Local:</strong> ${conflict.local.text} (Category: ${conflict.local.category}, Author: ${conflict.local.author || "Unknown"})</p>
                <p><strong>Server:</strong> ${conflict.server.text} (Category: ${conflict.server.category}, Author: ${conflict.server.author || "Unknown"})</p>
                <button class="accept-server" data-id="${conflict.id}">Accept Server</button>
                <button class="accept-local" data-id="${conflict.id}">Accept Local</button>
            </div>`;
    });

    modalContent += '<button class="close-modal">Close</button>';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    modal.querySelectorAll(".accept-server").forEach((button) => {
        button.addEventListener("click", async () => {
            const id = button.dataset.id;
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
        });
    });

    modal.querySelectorAll(".accept-local").forEach((button) => {
        button.addEventListener("click", async () => {
            const id = button.dataset.id;
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
        });
    });

    modal.querySelector(".close-modal").addEventListener("click", () => {
        modal.remove();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    syncQuotes();
});
