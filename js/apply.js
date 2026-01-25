// ================================
// APPLY FORM (validation + review modal + toast)
// ================================

(function () {
    // Match booking behavior: always start at top after reload
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    const form = document.querySelector("#applyForm");
     if (!form) return;

    // Inputs (MATCH apply.html IDs)
    const firstNameVal = document.querySelector("#firstName");
    const lastNameVal = document.querySelector("#lastName");
    const emailVal = document.querySelector("#email");
    const phoneVal = document.querySelector("#phone");

    const roleVal = document.querySelector("#role"); // <select>
    const availabilityVal = document.querySelector("#availability"); // <select>

    const neighborhoodVal = document.querySelector("#neighborhood"); // <input>
    const whyYouVal = document.querySelector("#whyYou"); // <textarea>
    const hobbiesVal = document.querySelector("#hobbies"); // <textarea>
    const storyVal = document.querySelector("#story"); // <textarea>

    const linkVal = document.querySelector("#link"); // <input> optional

    // ================================
    // Helpers
    // ================================
    const isRequired = (value) => (value ?? "").toString().trim() !== "";
    const maxLimit = (length, max) => length <= max;

    const isEmailValid = (email) => {
        const re =
            /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    };

    function normalizePhone(raw) {
        return (raw || "").toString().trim();
    }

    function isPhoneValid(phone) {
        const value = normalizePhone(phone);
        if (!value) return false;

        const lib = window.libphonenumber;
        if (lib && typeof lib.parsePhoneNumberFromString === "function") {
            try {
                const parsed = value.startsWith("+")
                    ? lib.parsePhoneNumberFromString(value)
                    : lib.parsePhoneNumberFromString(value, "US");
                return !!parsed && typeof parsed.isValid === "function" && parsed.isValid();
            } catch (_) {
                return false;
            }
        }

        // fallback
        const digits = value.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15;
    }

    const isUrlLike = (value) => {
        if (!value || value.trim() === "") return true;
        const v = value.trim();
        const re = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
        return re.test(v);
    };

    const showError = (input, message) => {
        const formField = input?.parentElement;
        if (!formField) return;
        formField.classList.add("error");
        formField.classList.remove("success");
        const error = formField.querySelector("small");
        if (error) error.textContent = message;
    };

    const showSuccess = (input) => {
        const formField = input?.parentElement;
        if (!formField) return;
        formField.classList.remove("error");
        formField.classList.add("success");
        const error = formField.querySelector("small");
        if (error) error.textContent = "";
    };

    const debounce = (fn, delay = 400) => {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    };

    // ================================
    // Validators
    // ================================
    const checkFirstName = () => {
        const v = firstNameVal.value.trim();
        if (!isRequired(v)) return showError(firstNameVal, "First Name cannot be blank."), false;
        showSuccess(firstNameVal);
        return true;
    };

    const checkLastName = () => {
        const v = lastNameVal.value.trim();
        if (!isRequired(v)) return showError(lastNameVal, "Last Name cannot be blank."), false;
        showSuccess(lastNameVal);
        return true;
    };

    const checkEmail = () => {
        const v = emailVal.value.trim();
        const max = 254;

        if (!isRequired(v)) return showError(emailVal, "Email cannot be blank."), false;
        if (!isEmailValid(v)) return showError(emailVal, "Invalid Email."), false;
        if (!maxLimit(v.length, max)) return showError(emailVal, "Email has too many characters."), false;

        showSuccess(emailVal);
        return true;
    };

    const checkPhone = () => {
        const v = phoneVal.value.trim();
        // IMPORTANT: don't enforce max input length here; libphonenumber handles it.
        if (!isRequired(v)) return showError(phoneVal, "Phone Number cannot be blank."), false;
        if (!isPhoneValid(v)) return showError(phoneVal, "Invalid phone number."), false;

        showSuccess(phoneVal);
        return true;
    };

    const checkSelect = (selectEl, label) => {
        const v = (selectEl.value || "").trim();
        if (!isRequired(v)) return showError(selectEl, `${label} is required.`), false;
        showSuccess(selectEl);
        return true;
    };

    const checkOptionalText = (inputEl, label, maxChars) => {
        const v = inputEl.value.trim();
        if (v === "") {
            showSuccess(inputEl);
            return true;
        }
        if (!maxLimit(v.length, maxChars))
            return showError(inputEl, `${label} must be under ${maxChars} characters.`), false;
        showSuccess(inputEl);
        return true;
    };

    const checkTextareaRequired = (textareaEl, label, maxChars) => {
        const v = textareaEl.value.trim();
        if (!isRequired(v)) return showError(textareaEl, `${label} cannot be blank.`), false;
        if (!maxLimit(v.length, maxChars))
            return showError(textareaEl, `${label} must be under ${maxChars} characters.`), false;
        showSuccess(textareaEl);
        return true;
    };

    const checkLinkOptional = () => {
        const v = linkVal.value.trim();
        if (!isUrlLike(v)) return showError(linkVal, "Please enter a valid URL (or leave it blank)."), false;
        showSuccess(linkVal);
        return true;
    };

    function validateInput(el) {
        if (!el || !el.id) return true;
        switch (el.id) {
            case "firstName":
                return checkFirstName();
            case "lastName":
                return checkLastName();
            case "email":
                return checkEmail();
            case "phone":
                return checkPhone();
            case "role":
                return checkSelect(roleVal, "Role");
            case "availability":
                return checkSelect(availabilityVal, "Availability");
            case "neighborhood":
                return checkOptionalText(neighborhoodVal, "Neighborhood", 60);
            case "whyYou":
                return checkTextareaRequired(whyYouVal, "Why should we consider you", 600);
            case "hobbies":
                return checkTextareaRequired(hobbiesVal, "Hobbies / interests", 300);
            case "story":
                return checkOptionalText(storyVal, "Story", 600);
            case "link":
                return checkLinkOptional();
            default:
                return true;
        }
    }

    // ================================
    // Floating label behavior (single source of truth)
    // ================================
    function setupInputField(el) {
        if (!el) return;

        const syncValid = () => {
            const hasValue =
                el.tagName === "SELECT" ? !!el.value : (el.value && el.value.trim().length > 0);
            el.classList.toggle("valid", hasValue);
        };

        el.addEventListener("focus", () => el.classList.add("focused"));
        el.addEventListener("blur", () => {
            validateInput(el);
            el.classList.remove("focused");
            syncValid();
        });

        el.addEventListener("input", syncValid);
        el.addEventListener("change", syncValid);

        syncValid();
    }

    [
        firstNameVal,
        lastNameVal,
        emailVal,
        phoneVal,
        roleVal,
        availabilityVal,
        neighborhoodVal,
        whyYouVal,
        hobbiesVal,
        storyVal,
        linkVal,
    ].forEach(setupInputField);

    // Live validation
    form.addEventListener(
        "input",
        debounce((e) => validateInput(e.target))
    );
    form.addEventListener(
        "change",
        debounce((e) => validateInput(e.target))
    );

    // ================================
    // Toast helper
    // ================================
    function showErrorToastWithFields(fields) {
        if (!window.Toastify) return;
        const lines = fields.map((f) => `- ${f}`).join("\n");
        Toastify({
            text: `There are errors found in your submission.\n\n${lines}\n\nPlease fix them.`.replace(/\n/g, "<br>"),
            escapeMarkup: false,
            duration: 6500,
            gravity: "top",
            position: "center",
            style: {
                background:
                    "radial-gradient(circle at 10.6% 22.1%, rgb(206, 18, 18) 0%, rgb(122, 21, 21) 100.7%)",
            },
            close: true,
            stopOnFocus: true,
        }).showToast();
    }

    function showSuccessToast(msg) {
        if (!window.Toastify) return;
        Toastify({
            text: msg,
            duration: 4500,
            gravity: "top",
            position: "center",
            style: {
                background:
                    "radial-gradient(circle at 10.6% 22.1%, rgb(34, 197, 94) 0%, rgb(21, 122, 57) 100.7%)",
            },
            close: true,
            stopOnFocus: true,
        }).showToast();
    }
    // ================================
    // Modal logic (Booking-like)
    // ================================
    function escapeHtml(s) {
        return (s ?? "")
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    let applyWaitTimer = null;

    function closeApplyModal() {
        const modal = document.getElementById("applyReviewModal");
        if (!modal) return;
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    
    function showApplicationConfirmationModal() {
            const menuButton = document.querySelector(".btn-menu");
            if (menuButton) {
                menuButton.style.pointerEvents = "none";
                menuButton.style.opacity = "0";
            }
            document.body.style.overflow = "hidden";
    
            const confirmationModal = document.getElementById("applicationConfirmationModal");
            if (!confirmationModal) return;
            confirmationModal.style.display = "block";
            confirmationModal.setAttribute("aria-hidden", "false");
        }

    function closeApplicationConfirmationModal() {
        const confirmationModal = document.getElementById("applicationConfirmationModal");
        if (!confirmationModal) return;

        // Hide modal
        confirmationModal.style.display = "none";
        confirmationModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        const menuButton = document.querySelector(".btn-menu");
        if (menuButton) {
            menuButton.style.pointerEvents = "auto";
            menuButton.style.opacity = "1";
        }


        setTimeout(() => {
            // Match booking behavior: force scroll-to-top right before reload
            window.onbeforeunload = function () { window.scrollTo(0, 0); };
            location.reload();
        }, 300);

    }

    function closeApplyModalAndShowConfirmation() {
            closeApplyModal();
            // Mirror booking flow: close review modal → short pause → show confirmation
            setTimeout(() => showApplicationConfirmationModal(), 1200);
        }
    
        function startApplyWaitCountdown(seconds) {
        const waitBtn = document.getElementById("applyModalWaitBtn");
        const confirmBtn = document.getElementById("applyModalConfirmBtn");
        const secsEl = document.getElementById("applyWaitSeconds");
        if (!waitBtn || !confirmBtn || !secsEl) return;

        waitBtn.style.display = "inline-block";
        confirmBtn.style.display = "none";
        waitBtn.disabled = true;

        let remaining = seconds;
        secsEl.textContent = `${remaining}s`;

        if (applyWaitTimer) clearInterval(applyWaitTimer);

        applyWaitTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(applyWaitTimer);
                applyWaitTimer = null;
                waitBtn.style.display = "none";
                confirmBtn.style.display = "inline-block";
                return;
            }
            secsEl.textContent = `${remaining}s`;
        }, 1000);
    }

    function openApplyModal(summary) {
        const modal = document.getElementById("applyReviewModal");
        if (!modal) return;

        document.getElementById("applyModalName").innerHTML = escapeHtml(summary.name);
        document.getElementById("applyModalEmail").innerHTML = escapeHtml(summary.email);
        document.getElementById("applyModalPhone").innerHTML = escapeHtml(summary.phone);
        document.getElementById("applyModalRole").innerHTML = escapeHtml(summary.role);
        document.getElementById("applyModalAvailability").innerHTML = escapeHtml(summary.availability);
        document.getElementById("applyModalNeighborhood").innerHTML = escapeHtml(summary.neighborhood);

        document.getElementById("applyModalWhy").innerHTML = escapeHtml(summary.why);
        document.getElementById("applyModalHobbies").innerHTML = escapeHtml(summary.hobbies);
        document.getElementById("applyModalStory").innerHTML = escapeHtml(summary.story);
        document.getElementById("applyModalLink").innerHTML = escapeHtml(summary.link || "(none)");

        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        startApplyWaitCountdown(10);
    }

    // bind modal buttons once
    (function bindApplyModalButtons() {
        const modal = document.getElementById("applyReviewModal");
        if (!modal) return;

        const backBtn = document.getElementById("applyModalBackBtn");
        const confirmBtn = document.getElementById("applyModalConfirmBtn");

        backBtn?.addEventListener("click", () => closeApplyModal());

        modal.addEventListener("click", (e) => {
            // Close only when clicking the dimmed backdrop (not the modal content)
            if (e.target === modal) closeApplyModal();
        });

        confirmBtn?.addEventListener("click", () => {
            // Close review modal, then show a booking-style confirmation modal
            closeApplyModalAndShowConfirmation();
            form.reset();

            // re-sync label states after reset
            [
                firstNameVal,
                lastNameVal,
                emailVal,
                phoneVal,
                roleVal,
                availabilityVal,
                neighborhoodVal,
                whyYouVal,
                hobbiesVal,
                storyVal,
                linkVal,
            ].forEach((el) => el && el.classList.remove("valid", "focused"));
        });

        // Confirmation modal close bindings
        const confirmationModal = document.getElementById("applicationConfirmationModal");
        const closeConfirmation = document.getElementById("closeApplicationConfirmationModal");

        closeConfirmation?.addEventListener("click", () => closeApplicationConfirmationModal());

        confirmationModal?.addEventListener("click", (e) => {
            if (e.target === confirmationModal) closeApplicationConfirmationModal();
        });

})();

    // ================================
    // Submit (validate → modal)
    // ================================
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const errors = [];
        const add = (ok, label) => {
            if (!ok) errors.push(label);
            return ok;
        };

        add(checkFirstName(), "First name");
        add(checkLastName(), "Last name");
        add(checkEmail(), "Email");
        add(checkPhone(), "Phone number");
        add(checkSelect(roleVal, "Role"), "Role");
        add(checkSelect(availabilityVal, "Availability"), "Availability");
        add(checkOptionalText(neighborhoodVal, "Neighborhood", 60), "Neighborhood");
        add(checkTextareaRequired(whyYouVal, "Why should we consider you", 600), "Why should we consider you");
        add(checkTextareaRequired(hobbiesVal, "Hobbies / interests", 300), "Hobbies / interests");
        add(checkOptionalText(storyVal, "Story", 600), "Story");
        add(checkLinkOptional(), "Link");

        const uniqueErrors = [...new Set(errors)];

        if (uniqueErrors.length > 0) {
            showErrorToastWithFields(uniqueErrors);
            return;
        }

        // Build summary + open modal
        const summary = {
            name: `${firstNameVal.value.trim()} ${lastNameVal.value.trim()}`.trim(),
            email: emailVal.value.trim(),
            phone: phoneVal.value.trim(),
            role: roleVal.options[roleVal.selectedIndex]?.text || "",
            availability: availabilityVal.options[availabilityVal.selectedIndex]?.text || "",
            neighborhood: neighborhoodVal.value.trim(),
            why: whyYouVal.value.trim(),
            hobbies: hobbiesVal.value.trim(),
            story: storyVal.value.trim(),
            link: linkVal?.value?.trim() || "",
        };

        openApplyModal(summary);
    });
})();
