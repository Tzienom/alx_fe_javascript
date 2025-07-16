import { quotes } from "./quotes.js";

document.addEventListener("DOMContentLoaded", () => {
    const quoteDisplay = document.getElementById("quoteDisplay");
    const newQuoteBtn = document.getElementById("newQuote");
    const newQuote = document.getElementById("newQuoteText");
    const quoteCategory = document.getElementById("newQuoteCategory");
    const addQuoteBtn = document.getElementById("addQuote");

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

    let shuffled = displayRandomQuotes(quotes);
    let currentIndex = 0;

    function showRandomQuote() {
        const displayQuote = (quoteDisplay.innerHTML = shuffled[currentIndex].text);
    }

    newQuoteBtn.addEventListener("click", () => {
        showRandomQuote();

        currentIndex++;

        if (currentIndex >= shuffled.length) {
            shuffled = displayRandomQuotes(quotes);
            currentIndex = 0;
        }
    });

    function createAddQuoteForm() {
        const quoteValue = newQuote.value.trim();
        const categoryValue = quoteCategory.value.trim();

        const userAddedQuote = document.createElement("p");

        if (quoteValue !== "" && categoryValue !== "") {
            quotes.push({
                id: Math.max(...quotes.map((q) => q.id + 1)),
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

        console.log(quotes);
    }

    addQuoteBtn.addEventListener("click", createAddQuoteForm);
});
