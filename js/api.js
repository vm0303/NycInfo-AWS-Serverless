(function () {
  function getBaseUrl() {
    const cfg =
        (window._config && window._config.api && window._config.api.invokeUrl) || "";
    return (cfg || "").replace(/\/+$/, "");
  }

  async function postJson(path, payload) {
    const base = getBaseUrl();
    if (!base) {
      throw new Error("API not configured. Set window._config.api.invokeUrl in js/config.js");
    }

    const url = base + path;

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Network/CORS/DNS failures land here
      throw new Error(`Network error calling API. Check CORS + invokeUrl. (${e?.message || e})`);
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { raw: text };
    }


    if (!res.ok) {
      const msg =
          (data && (data.message || data.error || data.warning)) ||
          `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  window.NYCINFO_API = {
    postApplication: (payload) => postJson("/applications", payload),
    postBooking: (payload) => postJson("/bookings", payload),
  };
})();
