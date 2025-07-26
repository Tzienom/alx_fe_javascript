export const serverURL = "http://localhost:3000/quotes";

// Fallback quotes for offline functionality
const fallbackQuotes = [
  {
    id: "1",
    text: "The only thing we have to fear is fear itself.",
    author: "Franklin D. Roosevelt",
    category: "Courage",
  },
  {
    id: "2",
    text: "To love and be loved is to feel the sun from both sides.",
    author: "David Viscott",
    category: "Love",
  },
  {
    id: "3",
    text: "I think, therefore I am.",
    author: "René Descartes",
    category: "Philosophy",
  },
  {
    id: "4",
    text: "In the middle of every difficulty lies opportunity.",
    author: "Albert Einstein",
    category: "Wisdom",
  },
  {
    id: "5",
    text: "The unexamined life is not worth living.",
    author: "Socrates",
    category: "Philosophy",
  },
];

let isServerAvailable = true;
let requestQueue = [];
let isProcessingQueue = false;

// Enhanced fetch with timeout and retry logic
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Check server availability
export async function checkServerHealth() {
  try {
    await fetchWithTimeout(serverURL, { method: "HEAD" });
    isServerAvailable = true;
    return true;
  } catch (error) {
    isServerAvailable = false;
    console.warn("Server unavailable, using offline mode:", error.message);
    return false;
  }
}

// Queue failed requests for retry when server comes back online
function queueRequest(operation, ...args) {
  requestQueue.push({ operation, args, timestamp: Date.now() });
}

// Process queued requests when server is back online
export async function processQueuedRequests() {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;
  const successfulRequests = [];

  for (const request of requestQueue) {
    try {
      await request.operation(...request.args);
      successfulRequests.push(request);
    } catch (error) {
      console.error("Failed to process queued request:", error);
      // Keep failed requests in queue for next attempt
    }
  }

  // Remove successful requests from queue
  requestQueue = requestQueue.filter(
    (req) => !successfulRequests.includes(req)
  );
  isProcessingQueue = false;
}

export async function fetchQuotesFromServer() {
  try {
    const response = await fetchWithTimeout(serverURL);
    const serverQuotes = await response.json();

    if (!Array.isArray(serverQuotes)) {
      throw new Error("Invalid data format received from server");
    }

    isServerAvailable = true;

    // Process any queued requests
    if (requestQueue.length > 0) {
      processQueuedRequests();
    }

    return serverQuotes;
  } catch (error) {
    console.log("Could not fetch quotes from the server:", error.message);
    isServerAvailable = false;

    // Return cached data if available, otherwise fallback quotes
    const cachedQuotes = localStorage.getItem("savedQuotes");
    if (cachedQuotes) {
      try {
        const parsed = JSON.parse(cachedQuotes);
        return Array.isArray(parsed) ? parsed : fallbackQuotes;
      } catch (parseError) {
        console.error("Failed to parse cached quotes:", parseError);
        return fallbackQuotes;
      }
    }

    return fallbackQuotes;
  }
}

export async function createQuoteOnServer(quoteObj) {
  if (!isServerAvailable) {
    queueRequest(createQuoteOnServer, quoteObj);
    throw new Error(
      "Server unavailable. Quote will be synced when connection is restored."
    );
  }

  try {
    const response = await fetchWithTimeout(serverURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...quoteObj,
        author: quoteObj.author || "Unknown",
      }),
    });

    return await response.json();
  } catch (error) {
    isServerAvailable = false;
    queueRequest(createQuoteOnServer, quoteObj);
    throw error;
  }
}

export async function updateQuoteOnServer(id, updatedFields) {
  if (!isServerAvailable) {
    queueRequest(updateQuoteOnServer, id, updatedFields);
    throw new Error(
      "Server unavailable. Update will be synced when connection is restored."
    );
  }

  try {
    const response = await fetchWithTimeout(`${serverURL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...updatedFields,
        author: updatedFields.author || "Unknown",
      }),
    });

    return await response.json();
  } catch (error) {
    isServerAvailable = false;
    queueRequest(updateQuoteOnServer, id, updatedFields);
    throw error;
  }
}

export async function deleteQuoteFromServer(id) {
  if (!isServerAvailable) {
    queueRequest(deleteQuoteFromServer, id);
    throw new Error(
      "Server unavailable. Deletion will be synced when connection is restored."
    );
  }

  try {
    const response = await fetchWithTimeout(`${serverURL}/${id}`, {
      method: "DELETE",
    });

    return await response.json();
  } catch (error) {
    isServerAvailable = false;
    queueRequest(deleteQuoteFromServer, id);
    throw error;
  }
}

// Periodic server health check
setInterval(async () => {
  if (!isServerAvailable) {
    const isHealthy = await checkServerHealth();
    if (isHealthy && requestQueue.length > 0) {
      processQueuedRequests();
    }
  }
}, 30000); // Check every 30 seconds
