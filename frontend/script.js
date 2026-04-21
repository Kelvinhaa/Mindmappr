function normalizeApiBase(value) {
    if (!value) return "";
    return value.replace(/\/$/, "");
}

const apiBaseFromMeta = document
    .querySelector('meta[name="mindmappr-api-base"]')
    ?.getAttribute("content") || "";

const API_BASE = (() => {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:8000";
    }

    
    return normalizeApiBase(apiBaseFromMeta);
})();

// DOM Elements
const studyForm = document.getElementById("studyForm");
const sendBtn = document.getElementById("sendBtn");
const btnText = sendBtn.querySelector(".btn-text");
const btnLoading = sendBtn.querySelector(".btn-loading");
const resultsSection = document.getElementById("resultsSection");
const resultsContent = document.getElementById("resultsContent");
const clearBtn = document.getElementById("clearBtn");
const formError = document.getElementById("formError");

// Set loading state
function setLoading(loading) {
    sendBtn.disabled = loading;
    btnText.classList.toggle("hidden", loading);
    btnLoading.classList.toggle("hidden", !loading);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function showFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
}

function hideFormError() {
    formError.classList.add("hidden");
}

// Show skeleton placeholders while loading
function showSkeleton(meta) {
    resultsSection.classList.remove("hidden");
    resultsContent.classList.remove("loaded");
    const goalHtml = meta.goal ? `<span>🎯 ${escapeHtml(meta.goal)}</span>` : "";
    resultsContent.innerHTML = `
        <div class="results-meta">
            <span>📚 ${escapeHtml(meta.subject)}</span>
            <span>⏱️ ${meta.time} min</span>
            <span>📊 ${escapeHtml(meta.level)}</span>
            ${goalHtml}
        </div>
        <div class="skeleton-container">
            <div class="skeleton-block skeleton-summary"></div>
            <div class="skeleton-block skeleton-technique"></div>
            <div class="skeleton-block skeleton-technique"></div>
            <div class="skeleton-block skeleton-tips"></div>
        </div>
    `;
}

// Render structured results
function showResults(data) {
    const rec = data.recommendation;

    if (!rec || !Array.isArray(rec.techniques) || !Array.isArray(rec.tips)) {
        console.warn("Unexpected recommendation shape:", rec);
        showError("Received an unexpected response format. Please try again.");
        return;
    }

    const goalHtml = data.goal ? `<span>🎯 ${escapeHtml(data.goal)}</span>` : "";

    const techniquesHtml = rec.techniques.map(t => `
        <div class="technique-card">
            <div class="technique-header">
                <span class="technique-title">${escapeHtml(t.title)}</span>
                <span class="technique-duration">${t.duration_minutes} min</span>
            </div>
            <p class="technique-description">${escapeHtml(t.description)}</p>
        </div>`).join("");

    const tipsHtml = rec.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join("");

    resultsContent.innerHTML = `
        <div class="results-meta">
            <span>📚 ${escapeHtml(data.subject)}</span>
            <span>⏱️ ${data.time} min</span>
            <span>📊 ${escapeHtml(data.level)}</span>
            ${goalHtml}
        </div>
        <div class="result-summary">${escapeHtml(rec.summary)}</div>
        <div class="techniques-grid">${techniquesHtml}</div>
        ${rec.tips.length > 0 ? `<div class="tips-callout"><div class="tips-label">Quick Tips</div><ul class="tips-list">${tipsHtml}</ul></div>` : ""}
    `;
    resultsContent.classList.add("loaded");
}

function showError(message) {
    resultsSection.classList.add("hidden");
    resultsContent.innerHTML = "";
    showFormError(message);
}

function clearResults() {
    resultsSection.classList.add("hidden");
    resultsContent.innerHTML = "";
    resultsContent.classList.remove("loaded");
    hideFormError();
    studyForm.reset();
}

// Submit form
async function handleSubmit(e) {
    e.preventDefault();
    hideFormError();

    const time = parseInt(document.getElementById("time").value, 10);
    const subject = document.getElementById("subject").value.trim();
    const level = document.getElementById("level").value;
    const goal = document.getElementById("goal").value.trim() || null;

    if (!subject || !time || !level) {
        showFormError("Please fill in all required fields.");
        return;
    }

    setLoading(true);
    showSkeleton({ subject, time, level, goal });

    try {
        const res = await fetch(`${API_BASE}/study/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ time, subject, level, goal }),
        });

        if (!res.ok) {
            let errorMessage = `Server error (${res.status})`;
            const contentType = res.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const errorData = await res.json().catch(() => ({}));
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } else {
                const errorText = await res.text().catch(() => "");
                if (errorText) {
                    errorMessage = errorText.slice(0, 200);
                }
            }

            throw new Error(errorMessage);
        }

        const data = await res.json();
        showResults(data);
    } catch (err) {
        showError(err.message === "Failed to fetch"
            ? "Cannot reach the server. Make sure the backend is running."
            : err.message || "Something went wrong.");
    } finally {
        setLoading(false);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    studyForm.addEventListener("submit", handleSubmit);
    clearBtn.addEventListener("click", clearResults);
});
