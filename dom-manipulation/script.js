import { quotes } from "./quotes.js";

document.addEventListener("DOMContentLoaded", () => {
    const quoteDisplay = document.getElementById("quoteDisplay");
    const newQuoteBtn = document.getElementById("newQuote");
    const newQuote = document.getElementById("newQuoteText");
    const quoteCategory = document.getElementById("newQuoteCategory");
    const addQuoteBtn = document.getElementById("addQuote");
    const importFileBtn = document.getElementById("importFile");

    const quoteSelect = document.getElementById("quote-categories");

    let shuffled = []; // Would be used to hold shuffled data
    let currentIndex = 0; // Would be used to increment shuffled data index progressively.

    let currentQuote; // Would be used to hold quote in sessionStorage.
    let categoryFilter = [...quotes];

    let quoteCategories = [];

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
                categoryFilter.length = 0;
                categoryFilter.push(...quotesInStorage);
                //maxID = findMaxID(JSON.parse(localStorage.getItem("savedQuotes")));
            }
        } catch (error) {
            console.error("Could not parse quotes from localStorage:", error);
        }

        /**
         * Check if there is a quote in sessionStorage, if true,
         * display the quote.
         */
        const lastSavedQuote = sessionStorage.getItem("currentQuote");
        if (lastSavedQuote) {
            const { index, quote } = JSON.parse(lastSavedQuote);
            quoteDisplay.innerHTML = quote.text;
            shuffled = displayRandomQuotes(categoryFilter);
        }
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

    function createAddQuoteForm(quote) {
        const quoteValue = newQuote.value.trim();
        const categoryValue = quoteCategory.value.trim();

        const userAddedQuote = document.createElement("p");

        if (quoteValue !== "" && categoryValue !== "") {
            categoryFilter.push({
                id: categoryFilter.length ? Math.max(...categoryFilter.map((q) => q.id)) + 1 : 0,
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

        localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));

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
    }

    // Allow user to download quotes as JSON file
    function exportJsonFile() {
        const exportBtn = document.getElementById("export-btn");
        const quotesToExport = localStorage.getItem("savedQuotes");
        const quotesBlob = new Blob([quotesToExport], { type: "application/json" });

        const quotesURL = URL.createObjectURL(quotesBlob);
        const downloadLink = document.createElement("a");

        downloadLink.href = quotesURL;
        downloadLink.download = "quotes.json";

        exportBtn.addEventListener("click", () => {
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
                const defaultOption = document.createElement("option");
                defaultOption.value = "all";
                defaultOption.textContent = "All";

                quoteSelect.appendChild(defaultOption);

                quotesInStorage.map((quoteCategory) => {
                    quoteCategories.push(quoteCategory.category);
                });

                quoteCategories = quoteCategories.filter((value, index, self) => self.indexOf(value) === index);

                quoteCategories.forEach((category) => {
                    const option = document.createElement("option");
                    option.value = category;
                    option.textContent = category;
                    quoteSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.log("Could not parse quote categories from localStorage:", error);
        }
    }

    function filterQuote(category) {
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
            category === "all" ? [...quotesInStorage] : quotesInStorage.filter((quote) => quote.category === category);

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
        currentIndex++;

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
            return;
        }

        showRandomQuote();
    });

    loadQuotes();
    exportJsonFile();
    populateCategories();
});
