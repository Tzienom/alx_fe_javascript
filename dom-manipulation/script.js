import { quotes } from "./quotes.js";

document.addEventListener("DOMContentLoaded", () => {
    const quoteDisplay = document.getElementById("quoteDisplay");
    const newQuoteBtn = document.getElementById("newQuote");
    const newQuote = document.getElementById("newQuoteText");
    const quoteCategory = document.getElementById("newQuoteCategory");
    const addQuoteBtn = document.getElementById("addQuote");

    let shuffled = []; // Would be used to hold shuffled data
    let currentIndex = 0; // Would be used to increment shuffled data index progressively.

    let currentQuote;

    function loadQuotes() {
        try {
            const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));
            if (Array.isArray(quotesInStorage)) {
                /**
                 * Because the original array is not empty, the array
                 * length must be set to zero, else the length shall be
                 * incremented twice the original length, each time there
                 * is a page reload.
                 */
                quotes.length = 0;
                quotes.push(...quotesInStorage);
            }
        } catch (error) {
            console.error("Could not parse quotes from localStorage:", error);
        }

        /**
         * Shuffle data from localStorage upon page load
         */
        //shuffled = displayRandomQuotes(quotes);

        const lastSavedQuote = sessionStorage.getItem("currentQuote");

        if (lastSavedQuote) {
            const { index, quote } = JSON.parse(lastSavedQuote);
            quoteDisplay.innerHTML = quote.text;
            shuffled = displayRandomQuotes(quotes);
        }

        /**
         * Immediately display a quote
         */
        //showRandomQuote();
    }

    /**
     * Reusable Component: Fisher-Yates algorithm to randomize elements
     * in an array without repetition.
     */
    function shuffleElements(elements) {
        for (let i = elements.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));

            [elements[i], elements[j]] = [elements[j], elements[i]];
        }

        return elements;
    }

    /**
     * displayRandomQuotes returns a shallow copy of shuffled data
     * from "quotes", the original array.
     */
    function displayRandomQuotes(quotesArray) {
        return shuffleElements([...quotesArray]);
    }

    function createAddQuoteForm(quote) {
        const quoteValue = newQuote.value.trim();
        const categoryValue = quoteCategory.value.trim();

        const userAddedQuote = document.createElement("p");

        if (quoteValue !== "" && categoryValue !== "") {
            quotes.push({
                id: quotes.length ? Math.max(...quotes.map((q) => q.id)) + 1 : 0,
                text: quoteValue,
                category: categoryValue
            });
            newQuote.value = "";
            quoteCategory.value = "";

            userAddedQuote.textContent = quoteValue;
            quoteDisplay.appendChild(userAddedQuote);
        } else {
            alert("Fill in both fields.");
        }

        localStorage.setItem("savedQuotes", JSON.stringify(quotes));

        /**
         * Upon user-added quote to localStorage, immediately refresh
         * (reshuffle) the data.
         *
         * PS: Even if user has begun cycling through quotes before adding
         * via form, this will immediately cause the quote to be included
         * in the quotes to be displayed (without manual refresh).
         */
        shuffled = displayRandomQuotes(quotes);
    }

    /**
     * Display random quote on the DOM
     */
    function showRandomQuote() {
        currentQuote = shuffled[currentIndex];

        quoteDisplay.innerHTML = shuffled[currentIndex].text;

        if (currentIndex < shuffled.length) {
            let lastViewedQuote = {
                index: currentIndex,
                quote: currentQuote
            };

            sessionStorage.setItem("currentQuote", JSON.stringify(lastViewedQuote));
        }

        console.log(shuffled);
    }

    newQuoteBtn.addEventListener("click", () => {
        currentIndex++;

        console.log(`${currentIndex}`);
        if (currentIndex >= shuffled.length) {
            shuffled = displayRandomQuotes(quotes); // Reshuffle data
            currentIndex = 0;

            /**
             * Because showRandomQuote() is immediately called in loadQuotes(),
             * it must be called here again, else the very first data
             * in the array shall be skipped when the data (array) is reshuffled.
             */
            showRandomQuote();
            return;
        }

        showRandomQuote();
    });

    addQuoteBtn.addEventListener("click", createAddQuoteForm);
    loadQuotes();
});
