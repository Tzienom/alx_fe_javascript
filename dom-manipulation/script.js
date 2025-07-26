import {
    fetchQuotesFromServer,
    createQuoteOnServer,
    deleteQuoteFromServer,
    updateQuoteOnServer,
    checkServerHealth
} from "./fetchQuotes.js";
import {
    showNotification,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showLoadingNotification,
    removeNotification
} from "./notifications.js";
import { syncQuotes } from "./syncQuotes.js";

// Application State Management
class QuoteAppState {
    constructor() {
        this.quotes = [];
        this.filteredQuotes = [];
        this.currentIndex = 0;
        this.currentQuote = null;
        this.categories = [];
        this.currentFilter = "all";
        this.currentSearchTerm = "";
        this.isLoading = false;
    }

    // Single source of truth for quotes
    setQuotes(quotes) {
        this.quotes = Array.isArray(quotes) ? quotes : [];
        this.updateCategories();
        this.applyCurrentFilters();
    }

    updateCategories() {
        this.categories = [...new Set(this.quotes.map((quote) => quote.category))].sort();
    }

    applyCurrentFilters() {
        let filtered = [...this.quotes];

        // Apply category filter
        if (this.currentFilter !== "all") {
            filtered = filtered.filter((quote) => quote.category === this.currentFilter);
        }

        // Apply search filter
        if (this.currentSearchTerm) {
            const searchTerm = this.currentSearchTerm.toLowerCase();
            filtered = filtered.filter(
                (quote) =>
                    quote.text.toLowerCase().includes(searchTerm) ||
                    (quote.author || "Unknown").toLowerCase().includes(searchTerm) ||
                    quote.category.toLowerCase().includes(searchTerm)
            );
        }

        this.filteredQuotes = this.shuffleArray(filtered);
        this.currentIndex = 0;

        // Update current quote
        if (this.filteredQuotes.length > 0) {
            this.currentQuote = this.filteredQuotes[0];
        } else {
            this.currentQuote = null;
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    nextQuote() {
        if (this.filteredQuotes.length === 0) {
            this.currentQuote = null;
            return null;
        }

        this.currentIndex = (this.currentIndex + 1) % this.filteredQuotes.length;
        this.currentQuote = this.filteredQuotes[this.currentIndex];
        return this.currentQuote;
    }

    addQuote(quote) {
        this.quotes.push(quote);
        this.updateCategories();
        this.applyCurrentFilters();
        this.saveToLocalStorage();
    }

    updateQuote(id, updatedFields) {
        const index = this.quotes.findIndex((quote) => quote.id === id);
        if (index !== -1) {
            this.quotes[index] = { ...this.quotes[index], ...updatedFields };
            this.updateCategories();
            this.applyCurrentFilters();
            this.saveToLocalStorage();

            // Update current quote if it's the one being updated
            if (this.currentQuote && this.currentQuote.id === id) {
                this.currentQuote = this.quotes[index];
            }
        }
    }

    deleteQuote(id) {
        this.quotes = this.quotes.filter((quote) => quote.id !== id);
        this.updateCategories();
        this.applyCurrentFilters();
        this.saveToLocalStorage();

        // Reset current quote if it was deleted
        if (this.currentQuote && this.currentQuote.id === id) {
            this.currentQuote = this.filteredQuotes.length > 0 ? this.filteredQuotes[0] : null;
            this.currentIndex = 0;
        }
    }

    setFilter(category) {
        this.currentFilter = category;
        this.applyCurrentFilters();
    }

    setSearchTerm(term) {
        this.currentSearchTerm = term.trim();
        this.applyCurrentFilters();
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem("savedQuotes", JSON.stringify(this.quotes));
        } catch (error) {
            console.error("Failed to save quotes to localStorage:", error);
            showErrorNotification("Failed to save quotes locally");
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem("savedQuotes");
            if (saved) {
                const quotes = JSON.parse(saved);
                this.setQuotes(Array.isArray(quotes) ? quotes : []);
            }
        } catch (error) {
            console.error("Failed to load quotes from localStorage:", error);
            showErrorNotification("Failed to load saved quotes");
        }
    }

    saveCurrentQuoteToSession() {
        if (this.currentQuote) {
            try {
                sessionStorage.setItem(
                    "currentQuote",
                    JSON.stringify({
                        index: this.currentIndex,
                        quote: this.currentQuote,
                        filter: this.currentFilter,
                        searchTerm: this.currentSearchTerm
                    })
                );
            } catch (error) {
                console.error("Failed to save current quote to session:", error);
            }
        }
    }

    loadCurrentQuoteFromSession() {
        try {
            const saved = sessionStorage.getItem("currentQuote");
            if (saved) {
                const data = JSON.parse(saved);
                this.currentFilter = data.filter || "all";
                this.currentSearchTerm = data.searchTerm || "";
                this.applyCurrentFilters();

                // Find the quote in filtered results
                const quoteIndex = this.filteredQuotes.findIndex((q) => q.id === data.quote.id);
                if (quoteIndex !== -1) {
                    this.currentIndex = quoteIndex;
                    this.currentQuote = this.filteredQuotes[quoteIndex];
                    return true;
                }
            }
        } catch (error) {
            console.error("Failed to load current quote from session:", error);
        }
        return false;
    }
}

// Input sanitization utility
function sanitizeInput(input) {
    return input.trim().replace(/[<>]/g, "");
}

// Debounce utility for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Find maximum ID utility
function findMaxID(quotes) {
    if (!quotes.length) return 0;
    return Math.max(...quotes.map((quote) => parseInt(quote.id) || 0));
}

// Main application logic
document.addEventListener("DOMContentLoaded", () => {
    // Initialize state
    const appState = new QuoteAppState();

    // DOM elements
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
    const exportBtn = document.getElementById("export-btn");

    // Loading state management
    function setLoadingState(isLoading) {
        appState.isLoading = isLoading;

        // Disable/enable buttons during loading
        [newQuoteBtn, addQuoteBtn, syncQuotesBtn, exportBtn].forEach((btn) => {
            if (btn) btn.disabled = isLoading;
        });

        if (isLoading) {
            newQuoteBtn.textContent = "Loading...";
        } else {
            newQuoteBtn.textContent = "Show New Quote";
        }
    }

    // Display quote on the DOM with proper sanitization
    function displayQuote() {
        if (!appState.currentQuote) {
            quoteDisplay.textContent =
                appState.filteredQuotes.length === 0 ? "No quotes match your current filters." : "No quotes available.";
            quoteAuthor.textContent = "";
            quoteCategory.textContent = "";
            updateButtonGroup();
            return;
        }

        const quote = appState.currentQuote;
        quoteDisplay.textContent = quote.text;
        quoteAuthor.textContent = quote.author || "Unknown";
        quoteCategory.textContent = quote.category;

        // Update filter selection to match current quote
        if (quoteSelect.value !== quote.category && appState.currentFilter === "all") {
            // Don't change filter if user has manually selected one
        }

        appState.saveCurrentQuoteToSession();
        updateButtonGroup();
    }

    // Update edit/delete buttons based on current quote
    function updateButtonGroup() {
        // Clear existing buttons
        buttonGroup.innerHTML = "";

        if (appState.currentQuote && appState.currentQuote.editable) {
            const editBtn = document.createElement("button");
            const deleteBtn = document.createElement("button");

            editBtn.textContent = "Edit Quote";
            deleteBtn.textContent = "Delete";
            editBtn.className = "edit-btn";
            deleteBtn.className = "delete-btn";

            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(deleteBtn);

            // Edit button handler
            editBtn.addEventListener("click", () => {
                showUpdateForm();
            });

            // Delete button handler
            deleteBtn.addEventListener("click", () => {
                showDeleteConfirmation();
            });
        }
    }

    // Show update form with current quote data
    function showUpdateForm() {
        if (!appState.currentQuote) return;

        newQuoteUpdate.value = appState.currentQuote.text;
        newAuthorUpdate.value = appState.currentQuote.author || "Unknown";

        // Populate categories dropdown
        populateCategoryDropdown(newCategoryUpdate, appState.currentQuote.category);

        quoteUpdateForm.style.display = "block";
    }

    // Show delete confirmation
    function showDeleteConfirmation() {
        if (!appState.currentQuote) return;

        const confirmed = confirm(
            `Are you sure you want to delete this quote?\n\n"${appState.currentQuote.text}"\n\nThis action cannot be undone.`
        );

        if (confirmed) {
            handleDeleteQuote(appState.currentQuote.id);
        }
    }

    // Populate category dropdown
    function populateCategoryDropdown(selectElement, selectedCategory = null) {
        selectElement.innerHTML = "";

        appState.categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            if (category === selectedCategory) option.selected = true;
            selectElement.appendChild(option);
        });
    }

    // Populate main category filter
    function populateMainCategoryFilter() {
        quoteSelect.innerHTML = "";

        // Add "All" option
        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.textContent = "All";
        quoteSelect.appendChild(allOption);

        // Add category options
        appState.categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            quoteSelect.appendChild(option);
        });

        // Set current filter
        quoteSelect.value = appState.currentFilter;
    }

    // Load quotes from server
    async function loadQuotes() {
        setLoadingState(true);

        try {
            const quotes = await fetchQuotesFromServer();
            appState.setQuotes(quotes);

            // Try to restore session state
            const sessionRestored = appState.loadCurrentQuoteFromSession();

            if (!sessionRestored && appState.filteredQuotes.length > 0) {
                appState.currentQuote = appState.filteredQuotes[0];
                appState.currentIndex = 0;
            }

            populateMainCategoryFilter();
            displayQuote();

            showSuccessNotification(`Loaded ${quotes.length} quotes successfully`);
        } catch (error) {
            console.error("Failed to load quotes:", error);
            showErrorNotification("Failed to load quotes. Using offline mode.");

            // Try to load from localStorage as fallback
            appState.loadFromLocalStorage();
            populateMainCategoryFilter();
            displayQuote();
        } finally {
            setLoadingState(false);
        }
    }

    // Handle adding new quote
    async function handleAddQuote() {
        const text = sanitizeInput(newQuote.value);
        const category = sanitizeInput(quoteCategoryInput.value);
        const author = sanitizeInput(quoteAuthorInput.value) || "Unknown";

        // Validation
        if (!text) {
            showWarningNotification("Quote text is required");
            newQuote.focus();
            return;
        }

        if (!category) {
            showWarningNotification("Category is required");
            quoteCategoryInput.focus();
            return;
        }

        // Check for duplicates
        const isDuplicate = appState.quotes.some(
            (quote) =>
                quote.text.toLowerCase() === text.toLowerCase() &&
                quote.category.toLowerCase() === category.toLowerCase()
        );

        if (isDuplicate) {
            showWarningNotification("This quote already exists");
            return;
        }

        setLoadingState(true);

        try {
            const newQuoteObj = {
                text,
                category,
                author,
                editable: true
            };

            const serverResponse = await createQuoteOnServer(newQuoteObj);

            // Add to state
            appState.addQuote(serverResponse);

            // Set as current quote
            appState.currentQuote = serverResponse;
            appState.currentIndex = appState.filteredQuotes.findIndex((q) => q.id === serverResponse.id);

            // Clear form
            newQuote.value = "";
            quoteCategoryInput.value = "";
            quoteAuthorInput.value = "";

            populateMainCategoryFilter();
            displayQuote();

            showSuccessNotification("Quote added successfully!");
        } catch (error) {
            console.error("Failed to add quote:", error);

            // Add locally even if server fails
            const localQuote = {
                id: (findMaxID(appState.quotes) + 1).toString(),
                text,
                category,
                author,
                editable: true
            };

            appState.addQuote(localQuote);
            appState.currentQuote = localQuote;
            appState.currentIndex = appState.filteredQuotes.findIndex((q) => q.id === localQuote.id);

            // Clear form
            newQuote.value = "";
            quoteCategoryInput.value = "";
            quoteAuthorInput.value = "";

            populateMainCategoryFilter();
            displayQuote();

            showWarningNotification("Quote added locally. Will sync to server when available.");
        } finally {
            setLoadingState(false);
        }
    }

    // Handle updating quote
    async function handleUpdateQuote() {
        if (!appState.currentQuote) return;

        const text = sanitizeInput(newQuoteUpdate.value);
        const category = sanitizeInput(newCategoryUpdate.value);
        const author = sanitizeInput(newAuthorUpdate.value) || "Unknown";

        // Validation
        if (!text) {
            showWarningNotification("Quote text is required");
            newQuoteUpdate.focus();
            return;
        }

        if (!category) {
            showWarningNotification("Category is required");
            newCategoryUpdate.focus();
            return;
        }

        setLoadingState(true);

        try {
            const updatedFields = { text, category, author, editable: true };

            await updateQuoteOnServer(appState.currentQuote.id, updatedFields);

            appState.updateQuote(appState.currentQuote.id, updatedFields);

            populateMainCategoryFilter();
            displayQuote();

            quoteUpdateForm.style.display = "none";
            showSuccessNotification("Quote updated successfully!");
        } catch (error) {
            console.error("Failed to update quote:", error);

            // Update locally even if server fails
            const updatedFields = { text, category, author, editable: true };
            appState.updateQuote(appState.currentQuote.id, updatedFields);

            populateMainCategoryFilter();
            displayQuote();

            quoteUpdateForm.style.display = "none";
            showWarningNotification("Quote updated locally. Will sync to server when available.");
        } finally {
            setLoadingState(false);
        }
    }

    // Handle deleting quote
    async function handleDeleteQuote(quoteId) {
        setLoadingState(true);

        try {
            await deleteQuoteFromServer(quoteId);

            appState.deleteQuote(quoteId);

            populateMainCategoryFilter();
            displayQuote();

            showSuccessNotification("Quote deleted successfully!");
        } catch (error) {
            console.error("Failed to delete quote:", error);

            // Delete locally even if server fails
            appState.deleteQuote(quoteId);

            populateMainCategoryFilter();
            displayQuote();

            showWarningNotification("Quote deleted locally. Will sync to server when available.");
        } finally {
            setLoadingState(false);
        }
    }

    // Handle search with debouncing
    const debouncedSearch = debounce((searchTerm) => {
        appState.setSearchTerm(searchTerm);
        displayQuote();
    }, 300);

    function handleSearch() {
        const searchTerm = sanitizeInput(searchBar.value);
        debouncedSearch(searchTerm);
    }

    // Handle category filter
    function handleCategoryFilter(category) {
        appState.setFilter(category);
        displayQuote();
    }

    // Handle export
    function handleExport() {
        try {
            const quotesToExport = JSON.stringify(appState.quotes, null, 2);
            const blob = new Blob([quotesToExport], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = `quotes-${new Date().toISOString().split("T")[0]}.json`;
            downloadLink.click();

            URL.revokeObjectURL(url);
            showSuccessNotification("Quotes exported successfully!");
        } catch (error) {
            console.error("Export failed:", error);
            showErrorNotification("Failed to export quotes");
        }
    }

    // Handle import
    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedQuotes = JSON.parse(e.target.result);

                if (!Array.isArray(importedQuotes)) {
                    throw new Error("Invalid file format");
                }

                const maxId = findMaxID(appState.quotes);
                let addedCount = 0;

                importedQuotes.forEach((quote, index) => {
                    if (quote.text && quote.category) {
                        // Check for duplicates
                        const isDuplicate = appState.quotes.some(
                            (existing) =>
                                existing.text.toLowerCase() === quote.text.toLowerCase() &&
                                existing.category.toLowerCase() === quote.category.toLowerCase()
                        );

                        if (!isDuplicate) {
                            const newQuote = {
                                id: (maxId + index + 1).toString(),
                                text: sanitizeInput(quote.text),
                                category: sanitizeInput(quote.category),
                                author: sanitizeInput(quote.author) || "Unknown",
                                editable: true
                            };
                            appState.addQuote(newQuote);
                            addedCount++;
                        }
                    }
                });

                populateMainCategoryFilter();
                displayQuote();

                showSuccessNotification(`Imported ${addedCount} new quotes successfully!`);
            } catch (error) {
                console.error("Import failed:", error);
                showErrorNotification("Failed to import quotes. Please check file format.");
            }
        };

        reader.readAsText(file);
        event.target.value = ""; // Reset file input
    }

    // Event Listeners
    newQuoteBtn.addEventListener("click", () => {
        if (appState.isLoading) return;
        appState.nextQuote();
        displayQuote();
    });

    addQuoteBtn.addEventListener("click", handleAddQuote);

    updateQuoteBtn.addEventListener("click", handleUpdateQuote);

    cancelUpdateBtn.addEventListener("click", () => {
        quoteUpdateForm.style.display = "none";
    });

    syncQuotesBtn.addEventListener("click", () => {
        syncQuotes(true);
    });

    searchBtn.addEventListener("click", handleSearch);

    searchBar.addEventListener("input", handleSearch);

    searchBar.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    });

    quoteSelect.addEventListener("change", (e) => {
        handleCategoryFilter(e.target.value);
    });

    exportBtn.addEventListener("click", handleExport);

    importFileBtn.addEventListener("change", handleImport);

    // Form submission handlers
    [newQuote, quoteCategoryInput, quoteAuthorInput].forEach((input) => {
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                handleAddQuote();
            }
        });
    });

    // Listen for quotes updated event
    document.addEventListener("quotesUpdated", (e) => {
        loadQuotes();
    });

    // Handle page visibility change for sync
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            // Page became visible, check for updates
            checkServerHealth().then((isHealthy) => {
                if (isHealthy) {
                    syncQuotes(false); // Silent sync
                }
            });
        }
    });

    // Initialize app
    loadQuotes();
});
