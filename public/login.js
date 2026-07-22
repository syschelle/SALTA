const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const errorBox = document.getElementById("loginError");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = "Anmeldung wird geprüft …";
  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const retryAfter = response.headers.get("Retry-After");
      const message = response.status === 429
        ? `Zu viele Anmeldeversuche. Bitte in ${retryAfter || "einigen"} Sekunden erneut versuchen.`
        : payload.error?.message || "Anmeldung fehlgeschlagen.";
      throw new Error(message);
    }
    location.replace("/");
  } catch (error) {
    errorBox.textContent = error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
    errorBox.hidden = false;
    passwordInput.select();
  } finally {
    button.disabled = false;
    button.textContent = "Anmelden";
  }
});
