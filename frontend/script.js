const API_BASE = "http://localhost:8000";

// DOM Elements
const studyForm = document.getElementById("studyForm");
const sendBtn = document.getElementById("sendBtn");
const btnText = sendBtn.querySelector(".btn-text");
const btnLoading = sendBtn.querySelector(".btn-loading");
const resultsSection = document.getElementById("resultsSection");
const resultsContent = document.getElementById("resultsContent");
const clearBtn = document.getElementById("clearBtn");
const statusBar = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");

// Check API status on load
async function checkApiStatus() {
    statusBar.className = "status-bar loading";
    statusText.textContent = "Connecting...";
    
    try {
        const res = await fetch(`${API_BASE}/`);
        if (res.ok) {
            statusBar.className = "status-bar online";
            statusText.textContent = "API Connected";
        } else {
            throw new Error("API error");
        }
    } catch (err) {
        statusBar.className = "status-bar offline";
        statusText.textContent = "API Offline – Start backend server";
    }
}

// Set loading state
function setLoading(loading) {
    sendBtn.disabled = loading;
    btnText.classList.toggle("hidden", loading);
    btnLoading.classList.toggle("hidden", !loading);
}

// Show results
function showResults(data) {
    resultsSection.classList.remove("hidden");
    
    resultsContent.innerHTML = `
        <div class="results-meta">
            <span>📚 ${data.subject}</span>
            <span>⏱️ ${data.time} min</span>
            <span>📊 ${data.level}</span>
        </div>
        <div class="recommendation-text">${data.recommendation || "No recommendation available."}</div>
    `;
}

// Show error
function showError(message) {
    resultsSection.classList.remove("hidden");
    resultsContent.innerHTML = `<div style="color: var(--error);">❌ ${message}</div>`;
}

// Clear results
function clearResults() {
    resultsSection.classList.add("hidden");
    resultsContent.innerHTML = "";
    studyForm.reset();
}

// Submit form
async function handleSubmit(e) {
    e.preventDefault();
    
    const time = parseInt(document.getElementById("time").value, 10);
    const subject = document.getElementById("subject").value.trim();
    const level = document.getElementById("level").value;

    if (!subject || !time || !level) {
        showError("Please fill in all fields.");
        return;
    }

    setLoading(true);

    try {
        const res = await fetch(`${API_BASE}/study/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ time, subject, level }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error ${res.status}`);
        }

        const data = await res.json();
        showResults(data);
    } catch (err) {
        showError(err.message || "Failed to connect to API");
    } finally {
        setLoading(false);
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    checkApiStatus();
    studyForm.addEventListener("submit", handleSubmit);
    clearBtn.addEventListener("click", clearResults);
});