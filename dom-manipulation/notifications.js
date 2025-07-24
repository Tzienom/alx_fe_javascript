export function showNotification(message, duration = 5000) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1f2a48;
    color: white;
    padding: 1em;
    border-radius; 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    z-index: 1000;`;

    notification.innerHTML = `<p>${message}</p>`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, duration);
}
