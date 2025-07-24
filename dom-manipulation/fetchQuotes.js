export const serverURL = "http://localhost:3000/quotes";

export async function fetchQuotesFromServer() {
    try {
        const response = await fetch(serverURL);
        const serverQuotes = await response.json();

        return serverQuotes;
    } catch (error) {
        console.log("Could not fetch quotes from the server:", error);
    }
}

export async function createQuoteOnServer(quoteObj) {
    const res = await fetch(serverURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteObj)
    });

    return await res.json();
}

export async function updateQuoteOnServer(id, updatedFields) {
    const res = await fetch(`${serverURL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
    });

    return await res.json();
}

export async function deleteQuoteFromServer(id) {
    const res = await fetch(`${serverURL}/${id}`, {
        method: "DELETE"
    });

    return await res.json();
}
