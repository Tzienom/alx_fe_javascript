const serverURL = "https://jsonplaceholder.typicode.com/posts";

import {
  fetchQuotesFromServer,
  createQuoteOnServer,
  deleteQuoteFromServer,
  updateQuoteOnServer,
  serverURL,
} from "./fetchQuotes.js";
import { showNotification } from "./notifications.js";
import { syncQuotes } from "./syncQuotes.js";

document.addEventListener("DOMContentLoaded", () => {
  const quoteDisplay = document.getElementById("quoteDisplay");
  const quoteAuthor = document.getElementById("quoteAuthor");
  const quoteCategory = document.getElementById("quoteCategory");
  const newQuoteBtn = document.getElementById("newQuote");
  const newQuote = document.getElementById("newQuoteText");
  const quoteCategoryInput = document.getElementById("newQuoteCategory");
  const quoteAuthorInput = document.getElementById("newQuoteAuthor");
  const addQuoteBtn = document.getElementById("addQuote");
  const syncQuotesBtn = document.getElementById("syncQuotes");
  const importFileBtn = document.getElementById("importFile");
  const searchBar = document.getElementById("search-input");
  const searchBtn = document.querySelector(".search-btn");

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
  let currentCategory; // Holds current category in sessionStorage.

  let quoteCategories = []; // Categories are dynamically populated here.
  let serverQuotes = []; // Quotes from the server (API) dwells here.
  let categoryFilter = []; // This would hold the quotes to be displayed on screen.

  function findMaxID(arr) {
    if (!arr.length) return 0;

    /**
     * First create a new array of IDs before
     * finding maximum number.
     */
    arr = arr.map((a) => a.id);

    /**
     * Using a custom Math.max() will be more memory efficient
     * should the quotes data grow very large.
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
      showNotification("Failed to load quotes from the server.", 5000);
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
        quoteAuthor.innerHTML = currentQuote.author || "Unknown";
        quoteCategory.innerHTML = currentQuote.category;
        quoteSelect.value = currentQuote.category;
      } else {
        currentIndex = 0;
        showRandomQuote();
      }
    }

    populateCategories();
    editDeleteQuote();
  } // End of loadQuotes()

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
      quoteAuthor.innerHTML = "";
      quoteCategory.innerHTML = "";
      return;
    }

    currentQuote = shuffled[currentIndex];
    quoteDisplay.innerHTML = currentQuote.text;
    quoteAuthor.innerHTML = currentQuote.author || "Unknown";
    quoteCategory.innerHTML = currentQuote.category;

    if (currentIndex < shuffled.length) {
      let lastViewedQuote = {
        index: currentIndex,
        quote: currentQuote,
        category: currentCategory,
      };

      sessionStorage.setItem("currentQuote", JSON.stringify(lastViewedQuote));
    }

    editDeleteQuote();
  } // End of showRandomQuote()

  async function createAddQuoteForm() {
    const quoteValue = newQuote.value.trim();
    const categoryValue = quoteCategoryInput.value.trim();
    const authorValue = quoteAuthorInput.value.trim() || "Unknown";

    if (quoteValue && categoryValue) {
      try {
        const newlyAddedQuote = await createQuoteOnServer({
          text: quoteValue,
          category: categoryValue,
          author: authorValue,
          editable: true,
        });

        /**
         * Push the new quote to the server
         */
        serverQuotes.push(newlyAddedQuote);

        /**
         * Include the newly added quote to the list of
         * quotes to be displayed
         */
        categoryFilter.push(newlyAddedQuote);

        quoteDisplay.innerHTML = newlyAddedQuote.text;
        quoteAuthor.innerHTML = newlyAddedQuote.author || "Unknown";
        quoteCategory.innerHTML = newlyAddedQuote.category;

        localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));

        /**
         * Refresh the category list immediately after
         * adding a new quote
         */
        populateCategories();

        /**
         * Upon user-added quote to localStorage, immediately refresh
         * (reshuffle) the data.
         *
         * PS: Even if user has begun cycling through quotes before adding
         * via form, this will immediately cause the quote to be included
         * in the quotes to be displayed (without manual refresh).
         */
        shuffled = displayRandomQuotes(categoryFilter);
        showNotification("Quote added successfully!", 5000);
      } catch (error) {
        showNotification("Failed to add quote to the server.", 5000);
      }
    } else {
      showNotification("Quote and category fields are a must-fill.", 5000);
    }
  } // End of createAddQuoteForm()

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
        try {
          await deleteQuoteFromServer(displayedQuote.id);

          /**
           * Remove deleted quote from server quotes
           */
          serverQuotes = serverQuotes.filter(
            (quote) => quote.id !== displayedQuote.id
          );
          /**
           * Remove deleted quote from the queue of displayed
           * quotes
           */
          categoryFilter = categoryFilter.filter(
            (quote) => quote.id !== displayedQuote.id
          );
          localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));

          /**
           * Reshuffle the quotes to be displayed
           */
          shuffled = displayRandomQuotes(categoryFilter);
          /**
           * Because of the deleted quote, currentIndex is
           * reset to ensure it doesn't go out of bounds.
           */
          currentIndex = Math.min(currentIndex, shuffled.length - 1);

          if (shuffled.length > 0) {
            showRandomQuote();
          } else {
            quoteDisplay.innerHTML =
              "<em>There are no quotes to display.</em>>";
            quoteAuthor.innerHTML = "";
            quoteCategory.innerHTML = "";
            currentQuote = null;
            sessionStorage.removeItem("currentQuote");
          }
          showNotification("Quote deleted successfully!", 5000);
        } catch (error) {
          showNotification("Failed to delete quote.", 5000);
        }
      }); // End of deleteBtn.addEventListener

      editBtn.addEventListener("click", () => {
        newQuoteUpdate.value = currentQuote.text;
        newCategoryUpdate.innerHTML = "";
        populateCategoryDropDown(newCategoryUpdate, currentQuote.category);
        newAuthorUpdate.value = currentQuote.author || "Unknown";

        quoteUpdateForm.style.display = "block";
      });
    }
  } // End of editDeleteQuote()

  function populateCategoryDropDown(selectElement, selectedCategory) {
    selectElement.innerHTML = "";

    quoteCategories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;

      if (category === selectedCategory) option.selected = true;
      selectElement.appendChild(option);
    });
  }

  /**
   * Update quote with property editable
   */
  updateQuoteBtn.addEventListener("click", async () => {
    const quoteValue = newQuoteUpdate.value.trim();
    const categoryValue = newCategoryUpdate.value.trim();
    const authorValue = newAuthorUpdate.value.trim();

    if (quoteValue && categoryValue) {
      try {
        const updatedFields = {
          text: quoteValue,
          category: categoryValue,
          author: authorValue,
          editable: true,
        };

        await updateQuoteOnServer(currentQuote.id, updatedFields);

        serverQuotes = serverQuotes.map((quote) =>
          quote.id === currentQuote.id ? { ...quote, ...updatedFields } : quote
        );
        categoryFilter = categoryFilter.map((quote) =>
          quote.id === currentQuote.id ? { ...quote, ...updatedFields } : quote
        );
        localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));

        /**
         * Reshuffle the quotes to be displayed to
         * include newly updated quote.
         */
        shuffled = displayRandomQuotes(categoryFilter);
        /**
         * Immediately display the updated fields of the current
         * quote.
         */
        currentQuote = { ...currentQuote, ...updatedFields };

        showRandomQuote();
        quoteUpdateForm.style.display = "none";
        showNotification("Quote updated successfully!", 5000);
      } catch (error) {
        showNotification("Failed to update quote.", 5000);
      }
    } else {
      showNotification("Quote and category fields are a must-fill.", 5000);
    }
  });

  cancelUpdateBtn.addEventListener("click", () => {
    quoteUpdateForm.style.display = "none";
  });

  function exportJsonFile() {
    const exportBtn = document.getElementById("export-btn");
    exportBtn.addEventListener("click", () => {
      const quotesToExport = localStorage.getItem("savedQuotes");
      const quotesBlob = new Blob([quotesToExport], {
        type: "application/json",
      });
      const quotesURL = URL.createObjectURL(quotesBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = quotesURL;
      downloadLink.download = "quotes.json";
      downloadLink.click();

      URL.revokeObjectURL(quotesURL);
      showNotification("Quotes exported successfully!", 5000);
    });
  }

  function importFromJsonFile(event) {
    const fileReader = new FileReader();
    fileReader.onload = function (event) {
      try {
        const importedQuotes = JSON.parse(event.target.result);
        const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));
        const maxID = findMaxID(quotesInStorage);

        if (Array.isArray(quotesInStorage)) {
          categoryFilter.length = 0;
          const updatedQuotes = importedQuotes.map((newQuote, index) => ({
            ...newQuote,
            id: (parseInt(maxID) + index + 1).toString(),
          }));
          categoryFilter.push(...quotesInStorage, ...updatedQuotes);
          saveQuotes();
          showNotification("Quotes imported successfully", 5000);
        }
      } catch (error) {
        console.error("Could not parse imported quotes.");
        showNotification("Failed to import quotes.", 5000);
      }
    };
    fileReader.readAsText(event.target.files[0]);
  }

  function saveQuotes() {
    localStorage.setItem("savedQuotes", JSON.stringify(categoryFilter));
    shuffled = displayRandomQuotes(categoryFilter);
    populateCategories();
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

        quoteCategories = [
          ...new Set(quotesInStorage.map((quote) => quote.category)),
        ];

        quoteCategories.forEach((category) => {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          quoteSelect.appendChild(option);
        });
        populateCategoryDropDown(
          newCategoryUpdate,
          currentQuote?.category || quoteCategories[0]
        );
      }
    } catch (error) {
      console.error(
        "Could not parse quote categories from localStorage.",
        error
      );
      showNotification("Failed to load categories.", 5000);
    }
  }

  function filterQuote(selectedCategory) {
    currentIndex = 0;
    const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));
    categoryFilter =
      selectedCategory === "all"
        ? [...quotesInStorage]
        : quotesInStorage.filter(
            (quote) => quote.category === selectedCategory
          );

    shuffled = displayRandomQuotes(categoryFilter);

    if (shuffled.length > 0) showRandomQuote();
    else {
      quoteDisplay.innerHTML = "<em>There are not quotes to display.</em>";
      quoteAuthor.innerHTML = "";
      quoteCategory.innerHTML = "";
    }
  }

  function searchQuotes() {
    const searchItem = searchBar.value.trim().toLowerCase();
    currentIndex = 0;
    const quotesInStorage = JSON.parse(localStorage.getItem("savedQuotes"));
    categoryFilter = quotesInStorage.filter(
      (quote) =>
        quote.text.toLowerCase().includes(searchItem) ||
        (quote.author || "Unknown").toLowerCase().includes(searchItem) ||
        quote.category.toLowerCase().includes(searchItem)
    );

    shuffled = displayRandomQuotes(categoryFilter);
    if (shuffled.length > 0) showRandomQuote();
    else {
      quoteDisplay.innerHTML = "<em>No quotes match your search.</em>";
      quoteAuthor.innerHTML = "";
      quoteCategory.innerHTML = "";
    }
  }

  quoteSelect.addEventListener("change", (event) => {
    filterQuote(event.target.value);
  });

  addQuoteBtn.addEventListener("click", createAddQuoteForm);
  importFileBtn.addEventListener("change", importFromJsonFile);
  searchBtn.addEventListener("click", searchQuotes);
  searchBar.addEventListener("keypress", (event) => {
    if (event.key === "Enter") searchQuotes();
  });

  newQuoteBtn.addEventListener("click", () => {
    if (currentIndex >= shuffled.length) {
      shuffled = displayRandomQuotes(categoryFilter);
      currentIndex = 0;
    }

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
  });

  syncQuotesBtn.addEventListener("click", () => {
    syncQuotes();
    showNotification("Syncing quotes from server.", 5000);
  });

  loadQuotes();
  populateCategories();
  exportJsonFile();

  document.addEventListener("quotesUpdated", () => {
    loadQuotes();
  });
});
