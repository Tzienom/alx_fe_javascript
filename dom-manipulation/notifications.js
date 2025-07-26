let notificationContainer = null;
let activeNotifications = new Set();

// Initialize notification container
function initNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement("div");
        notificationContainer.className = "notification-container";
        notificationContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;`;

        document.body.appendChild(notificationContainer);
    }
}

// Sanitize HTML content to prevent XSS
function sanitizeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

export function showNotification(message, duration = 5000, type = "info") {
    initNotificationContainer();

    const notification = document.createElement("div");
    const notificationID = Date.now() + Math.random();

    // Different styles for different notification types
    const typeStyles = {
        info: "background: #1f2a48; border-left: 4px solid #0079fe;",
        success: "background: #1f2a48; border-left: 4px solid #00a86b;",
        warning: "background: #1f2a48; border-left: 4px solid #ffa500;",
        error: "background: #1f2a48; border-left: 4px solid #ff6b6b;"
    };

    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
    ${typeStyles[type] || typeStyles.info}
    color: white;
    padding: 1em 1.5em;
    margin-bottom: 10px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
    opacity: 0;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    max-width: 100%;
    word-wrap: break-word;`;

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "x";
    closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    float: right;
    margin-left: 10px;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;`;

    closeButton.addEventListener("mouseenter", () => {
        closeButton.style.opacity = "1";
    });

    closeButton.addEventListener("mouseleave", () => {
        closeButton.style.opacity = "0.7";
    });

    // Create message content with proper sanitization
    const messageContent = document.createElement("div");
    messageContent.style.cssText = "margin-right: 20px;";

    // Check if message contains HTML for buttons (specific case for conflict resolution)
    if (message.includes("<button>") && message.includes("review-conflicts")) {
        messageContent.innerHTML = message; // Allow specific HTML for functionality
    } else {
        messageContent.textContent = message; // Sanitize all other content
    }

    notification.appendChild(messageContent);
    notification.appendChild(closeButton);
    notificationContainer.appendChild(notification);
    activeNotifications.add(notificationID);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = "translateX(0)";
        notification.style.opacity = "1";
    });

    // Remove notification function
    const removeNotification = () => {
        if (activeNotifications.has(notificationID)) {
            activeNotifications.delete(notificationID);
            notification.style.transform = "translateX(100%)";
            notification.style.opacity = "0";

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    };

    // Auto-remove after duration (if duration > 0)
    let autoRemoveTimer = null;
    if (duration > 0) {
        autoRemoveTimer = setTimeout(removeNotification, duration);
    }

    // Manual close
    closeButton.addEventListener("click", () => {
        if (autoRemoveTimer) {
            clearTimeout(autoRemoveTimer);
        }
        removeNotification();
    });

    // Pause auto-remove on hover, resume on leave
    notification.addEventListener("mouseenter", () => {
        if (autoRemoveTimer) {
            clearTimeout(autoRemoveTimer);
        }
    });

    notification.addEventListener("mouseleave", () => {
        if (duration > 0 && activeNotifications.has(notificationID)) {
            autoRemoveTimer = setTimeout(removeNotification, 2000);
        }
    });

    return notificationID;
}

// Convenience methods for different notification types
export function showSuccessNotification(message, duration = 4000) {
    return showNotification(message, duration, "success");
}

export function showErrorNotification(message, duration = 8000) {
    return showNotification(message, duration, "error");
}

export function showWarningNotification(message, duration = 6000) {
    return showNotification(message, duration, "warning");
}

// Show loading notification that must be manually dismissed
export function showLoadingNotification(message) {
    return showNotification(`${message}...`, 0, "info");
}

// Clear all notifications() {
export function clearAllNotfications() {
    activeNotifications.forEach((id) => {
        const notification = document.querySelector(`[data-notification-id="${id}"]`);
        if (notification) {
            notificatio.click(); // Trigger close
        }
    });
    activeNotifications.clear();
}

// Remove specific notification by ID
export function removeNotification(notificationID) {
    if (activeNotifications.has(notificationID)) {
        const notification = document.querySelector(`[data-notification-id="${notificationID}"]`);

        if (notification) {
            notification.querySelector("button").click();
        }
    }
}
