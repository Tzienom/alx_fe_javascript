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
     * ShuffleQuotes returns a shallow copy of shuffled data
     * from "quotes", the original array.
     */
    function shuffleQuotes(quotesArray) {
        return shuffleElements([...quotesArray]);
    }

    let shuffled = shuffleQuotes(quotes);
    let currentIndex = 0;

    function displayRandomQuote() {
        const searchInput = (quoteDisplay.textContent = shuffled[currentIndex].text);
    }

    newQuoteBtn.addEventListener("click", () => {
        displayRandomQuote();

        currentIndex++;

        if (currentIndex >= shuffled.length) {
            shuffled = shuffleQuotes(quotes);
            currentIndex = 0;
        }
    });

    function createAddQuoteForm() {
        const quoteValue = newQuote.value.trim();
        const categoryValue = quoteCategory.value.trim();

        if (quoteValue !== "" && categoryValue !== "") {
            quotes.push({
                id: Math.max(...quotes.map((q) => q.id + 1)),
                text: quoteValue,
                category: categoryValue
            });
            newQuote.value = "";
            quoteCategory.value = "";
        } else {
            alert("Fill in both fields.");
        }

        console.log(quotes);
    }

    console.log(Math.max(...quotes.map((q) => q.id + 1)));

    addQuoteBtn.addEventListener("click", createAddQuoteForm);
});
