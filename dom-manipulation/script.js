import {
    fetchQuotesFromServer,
    createQuoteOnServer,
    deleteQuoteFromServer,
    updateQuoteOnServer,
    serverURL
} from "./fetchQuotes.js";

import { showNotification } from "./notifications.js";

document.addEventListener("DOMContentLoaded", () => {
    const quoteDisplay = document.getElementById("quoteDisplay");
    const newQuoteBtn = document.getElementById("newQuote");
    const newQuote = document.getElementById("newQuoteText");
    const quoteCategory = document.getElementById("newQuoteCategory");
    const addQuoteBtn = document.getElementById("addQuote");
    const importFileBtn = document.getElementById("importFile");

    const quoteUpdateForm = document.getElementById("quote-update-form");
    const updateQuoteBtn = document.getElementById("update-quote-btn");
    const cancelUpdateBtn = document.getElementById("cancel-btn");
    const newQuoteUpdate = document.getElementById("quote-update");
    const newCategoryUpdate = document.getElementById("category-update");
    const newAuthorUpdate = document.getElementById("author-update");

    const quoteSelect = document.getElementById("quote-categories");
    const buttonGroup = document.querySelector(".button-group");

    let shuffled = []; // Would be used to hold shuffled data
    let currentIndex = 0; // Would be used to increment shuffled data index progressively.

    let currentQuote; // Would be used to hold quote in sessionStorage.
    let currentCategory;

    let quoteCategories = [];
    let serverQuotes = [];
    let categoryFilter = [];

    function findMaxID(arr) {
        if (!arr.length) return 0;

        /**
         * First create a new array of IDs before
         * finding maximum number.
         */
        arr = arr.map((a) => a.id);

        /**
         * Using a custom Math.max() will be more memory efficient
         * should the quotes data grow very large
         */
        let max = -Infinity;
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] > max) {
                max = arr[i];
            }
        }

        return max;
    }

    async function loadQuotes() {
        try {
            const quotes = await fetchQuotesFromServer();
            serverQuotes.push(...quotes);

            localStorage.setItem("savedQuotes", JSON.stringify(serverQuotes));
        } catch (error) {
            console.error("Could not parse quotes from localStorage:", error);
        }

        shuffled = displayRandomQuotes(serverQuotes);
        categoryFilter = [...serverQuotes];

        /**
         * Check if there is a quote in sessionStorage, if true,
         * display the quote.
         */
        const lastSavedQuote = sessionStorage.getItem("currentQuote");
        if (lastSavedQuote) {
            const { index, quote, category } = JSON.parse(lastSavedQuote);
            currentIndex = shuffled.findIndex((item) => item.id === quote.id);

            if (currentIndex >= 0) {
                currentQuote = shuffled[currentIndex];
                quoteDisplay.innerHTML = currentQuote.text;
                quoteSelect.value = currentQuote.category;
            } else {
                currentIndex = 0;
                showRandomQuote();
            }

            return;
        }

        populateCategories();
        editDeleteQuote();
    }

    /**
     * Reusable Component: Fisher-Yates algorithm to randomize elements
     * in an array without repetition. In plainer terms, each element has
     * an equal chance of being randomized.
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

    /**
     * Display random quote on the DOM
     */
    function showRandomQuote() {
        if (!shuffled.length || !shuffled[currentIndex]) {
            quoteDisplay.innerHTML = "<em>There are no quotes to display.</em>";
            return;
        }

        currentQuote = shuffled[currentIndex];

        quoteDisplay.innerHTML = shuffled[currentIndex].text;

        if (currentIndex < shuffled.length) {
            let lastViewedQuote = {
                index: currentIndex,
                quote: currentQuote,
                category: currentCategory
            };

            sessionStorage.setItem("currentQuote", JSON.stringify(lastViewedQuote));
        }

        editDeleteQuote();
    }

    async function createAddQuoteForm(quote) {
        const quoteValue = newQuote.value.trim();
        const categoryValue = quoteCategory.value.trim();

        const userAddedQuote = document.createElement("p");

        if (quoteValue !== "" && categoryValue !== "") {
            const newlyAddedQuote = await createQuoteOnServer({
                text: quoteValue,
                category: categoryValue,
                editable: true
            });

            serverQuotes.push(newlyAddedQuote);
            categoryFilter.push(newlyAddedQuote);

            newQuote.value = "";
            quoteCategory.value = "";

            userAddedQuote.textContent = quoteValue;
            quoteDisplay.appendChild(userAddedQuote);

            localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));
            populateCategories();
        } else {
            alert("Fill in both fields.");
        }

        /**
         * Upon user-added quote to localStorage, immediately refresh
         * (reshuffle) the data.
         *
         * PS: Even if user has begun cycling through quotes before adding
         * via form, this will immediately cause the quote to be included
         * in the quotes to be displayed (without manual refresh).
         */
        shuffled = displayRandomQuotes(categoryFilter);
    }

    async function editDeleteQuote() {
        serverQuotes = await fetchQuotesFromServer();
        const displayedQuote = currentQuote;

        const existingButtons = buttonGroup.querySelectorAll("button");
        existingButtons.forEach((button) => button.remove());

        if (displayedQuote && displayedQuote.editable === true) {
            const editBtn = document.createElement("button");
            const deleteBtn = document.createElement("button");

            editBtn.textContent = "Edit Quote";
            deleteBtn.textContent = "Delete";

            editBtn.dataset.quoteId = displayedQuote.id;
            deleteBtn.dataset.quoteId = displayedQuote.id;

            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(deleteBtn);

            deleteBtn.addEventListener("click", async () => {
                await deleteQuoteFromServer(displayedQuote.id);

                serverQuotes = serverQuotes.filter((quote) => quote.id !== displayedQuote.id);
                categoryFilter = categoryFilter.filter((quote) => quote.id !== displayedQuote.id);
                localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));
                shuffled = displayRandomQuotes(categoryFilter);
                currentIndex = Math.min(currentIndex, shuffled.length - 1);

                if (shuffled.length > 0) {
                    showRandomQuote();
                } else {
                    quoteDisplay.innerHTML = "<em>There are no more quotes to show in this category.</em>";
                    currentQuote = null;
                    sessionStorage.removeItem("currentQuote");
                }
            });

            editBtn.addEventListener("click", () => {
                newQuoteUpdate.value = currentQuote.text;
                newCategoryUpdate.value = currentQuote.category;
                newAuthorUpdate.value = currentQuote.author || "Unknown";

                quoteUpdateForm.style.display = "block";
            });

            return;
        }
    }

    updateQuoteBtn.addEventListener("click", () => {
        if (newQuoteUpdate.value !== "" || newCategoryUpdate.value !== "" || newAuthorUpdate.value !== "") {
            //await updateQuoteOnServer(displayedQuote.id);
            console.log(newQuoteUpdate.value, newCategoryUpdate.value, newAuthorUpdate.value);
        }
    });

    // Allow user to download quotes as JSON file
    function exportJsonFile() {
        const exportBtn = document.getElementById("export-btn");

        exportBtn.addEventListener("click", () => {
            const quotesToExport = localStorage.getItem("savedQuotes");
            const quotesBlob = new Blob([quotesToExport], { type: "application/json" });

            const quotesURL = URL.createObjectURL(quotesBlob);
            const downloadLink = document.createElement("a");

            downloadLink.href = quotesURL;
            downloadLink.download = "quotes.json";

            downloadLink.click();

            URL.revokeObjectURL(quotesURL);
        });
    }

    function importFromJsonFile(event) {
        const fileReader = new FileReader();

        fileReader.onload = function (event) {
            const importedQuotes = JSON.parse(event.target.result);

            try {
                const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes")) || [];
                const maxID = findMaxID(quotesInStorage);

                if (Array.isArray(quotesInStorage)) {
                    categoryFilter.length = 0;

                    const updatedQuotes = importedQuotes.map((newQuote, index) => ({
                        ...newQuote,
                        id: maxID + index + 1
                    }));

                    categoryFilter.push(...quotesInStorage, ...updatedQuotes);
                }
            } catch (error) {
                console.error("Could not parse quotes from localStorage:", error);
            }

            saveQuotes();
            alert("Quotes imported successfully!");
        };
        fileReader.readAsText(event.target.files[0]);
    }

    function saveQuotes() {
        localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));

        /**
         * Immediately add the imported file to the queue
         * of data to be displayed, without the need for
         * a manual reload.
         */
        shuffled = displayRandomQuotes(categoryFilter);
    }

    function populateCategories() {
        let quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));

        try {
            if (Array.isArray(quotesInStorage)) {
                quoteSelect.innerHTML = "";

                const defaultOption = document.createElement("option");
                defaultOption.value = "all";
                defaultOption.textContent = "All";

                quoteSelect.appendChild(defaultOption);
                quoteCategories = [];

                quoteCategories = [...new Set(quotesInStorage.map((quote) => quote.category))];

                quoteCategories.forEach((category) => {
                    const option = document.createElement("option");
                    option.value = category;
                    option.textContent = category;
                    quoteSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Could not parse quote categories from localStorage:", error);
        }
    }

    function filterQuote(selectedCategory) {
        /**
         * currentIndex must be reset in here, else it will yield
         * an error. This is because currentIndex is a global variable,
         * and for each time the quotes are traversed, currentIndex is
         * incremented by 1. So when the filterQuote runs, if
         * the currentIndex is, say 7, and the filtered result has a length
         * of 2, an error will be thrown.
         */
        currentIndex = 0;
        const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));

        categoryFilter =
            selectedCategory === "all"
                ? [...quotesInStorage]
                : quotesInStorage.filter((quote) => quote.category === selectedCategory);

        shuffled = displayRandomQuotes(categoryFilter);

        if (shuffled.length > 0) showRandomQuote();
        else quoteDisplay.innerHTML = "<em>There are no quotes to show in this category.</em>";
    }

    quoteSelect.addEventListener("change", (event) => {
        filterQuote(event.target.value);
    });

    addQuoteBtn.addEventListener("click", createAddQuoteForm);
    importFileBtn.addEventListener("change", importFromJsonFile);

    newQuoteBtn.addEventListener("click", () => {
        //currentIndex++;

        if (currentIndex >= shuffled.length) {
            shuffled = displayRandomQuotes(categoryFilter); // Reshuffle data
            currentIndex = 0;

            /**
             * showRandomQuote() is invoked here in order to reshuffle
             * data immediately.
             *
             * NOTE: Because currentIndex = 0 at the start of the script and yet
             * there is no preloaded quote, the first button click shall display no
             * quote when currentIndex = 1, until currentIndex = 2, which skips
             * the first quote in the array. It is also for that reason showRandomQuote
             * is called here--to fix skipping and not displaying the first quote.
             */
            showRandomQuote();
            currentIndex++;

            return;
        }

        showRandomQuote();
        currentIndex++;
    });

    loadQuotes();
    populateCategories();
    exportJsonFile();
});
