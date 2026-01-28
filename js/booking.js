/* ===============================
   ELEMENTS
   =============================== */

const firstNameVal = document.querySelector('#f_name');
const lastNameVal = document.querySelector('#l_name');
const emailVal = document.querySelector('#email');
const phoneVal = document.querySelector('#phone');
const adultVal = document.querySelector('#numOfAdultsInput');
const childrenVal = document.querySelector('#numOfChildrenInput');
const dateAndTimeVal = document.querySelector('#theDateAndTimeInput');
const privateTourVal = document.querySelector('#privateTour');
const cardHolderNameVal = document.querySelector('#cardHolderName');
const cardNumberVal = document.querySelector('#cardNumber');
const expireDateVal = document.querySelector("#expirationDate");
const cvvOrCvcVal = document.querySelector("#securityCode");
const specialRequestsVal = document.querySelector('#specialRequests');

const form = document.querySelector('#bookTour');
let pendingBooking = null;

/* ===============================
   HELPERS
   =============================== */

function digitsOnly(s) {
    return (s ?? '').toString().replace(/\D/g, '');
}

function isAmexDigits(d) {
    return /^3[47]/.test(d);
}

function formatCardNumberForDisplay(rawDigits) {
    const d = rawDigits || '';
    if (isAmexDigits(d)) {
        const p1 = d.slice(0, 4);
        const p2 = d.slice(4, 10);
        const p3 = d.slice(10, 15);
        return [p1, p2, p3].filter(Boolean).join(' ');
    }
    return d.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpForDisplay(digits) {
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + '/' + digits.slice(2, 4);
}

/* ===============================
   LIVE PAYMENT INPUT SANITIZERS
   =============================== */

cardNumberVal.addEventListener('input', (e) => {
    const el = e.target;
    const digits = digitsOnly(el.value);
    const maxLen = isAmexDigits(digits) ? 15 : 19;
    const raw = digits.slice(0, maxLen);

    el.dataset.raw = raw;

    // live icon
    updateCardTypeIcon(getCardTypeByIIN(raw));

    const formatted = formatCardNumberForDisplay(raw);
    if (el.value !== formatted) el.value = formatted;

    // CVV max length
    const maxCvv = isAmexDigits(raw) ? 4 : 3;
    cvvOrCvcVal.maxLength = maxCvv;

    // trim CVV if needed
    const cvvRaw = digitsOnly(cvvOrCvcVal.value);
    if (cvvRaw.length > maxCvv) cvvOrCvcVal.value = cvvRaw.slice(0, maxCvv);
});

cvvOrCvcVal.addEventListener('input', (e) => {
    const rawCard = cardNumberVal.dataset.raw || digitsOnly(cardNumberVal.value);
    const maxCvv = isAmexDigits(rawCard) ? 4 : 3;
    const rawCvv = digitsOnly(e.target.value).slice(0, maxCvv);
    if (e.target.value !== rawCvv) e.target.value = rawCvv;
});

expireDateVal.addEventListener('input', (e) => {
    const el = e.target;
    const raw = digitsOnly(el.value).slice(0, 4);
    const formatted = formatExpForDisplay(raw);
    if (el.value !== formatted) el.value = formatted;
});

/* ===============================
   VALIDATION HELPERS
   =============================== */

const isRequired = value => (value ?? '').toString().trim() !== '';

const isEmailValid = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};

function isPhoneValid(phone) {
    const value = (phone || '').toString().trim();
    if (!value) return false;

    const lib = window.libphonenumber;
    if (lib && typeof lib.parsePhoneNumberFromString === 'function') {
        try {
            const parsed = value.startsWith('+')
                ? lib.parsePhoneNumberFromString(value)
                : lib.parsePhoneNumberFromString(value, 'US');
            return !!parsed && parsed.isValid();
        } catch {
            return false;
        }
    }

    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
}

const showError = (input, message) => {
    const formField = input.parentElement;
    formField.classList.add('error');
    const error = formField.querySelector('small');
    if (error) error.textContent = message;
};

const showSuccess = (input) => {
    const formField = input.parentElement;
    formField.classList.remove('error');
    formField.classList.add('success');
    const error = formField.querySelector('small');
    if (error) error.textContent = '';
};

const clearStatus = (input) => {
    const formField = input.parentElement;
    formField.classList.remove('error');
    formField.classList.remove('success');
    const error = formField.querySelector('small');
    if (error) error.textContent = '';
};

/* ===============================
   FIELD CHECKS
   =============================== */

const checkFirstName = () => {
    const v = firstNameVal.value.trim();
    if (!isRequired(v)) { showError(firstNameVal, 'First Name cannot be blank.'); return false; }
    showSuccess(firstNameVal); return true;
};

const checkLastName = () => {
    const v = lastNameVal.value.trim();
    if (!isRequired(v)) { showError(lastNameVal, 'Last Name cannot be blank.'); return false; }
    showSuccess(lastNameVal); return true;
};

const checkEmail = () => {
    const v = emailVal.value.trim();
    if (!isRequired(v)) { showError(emailVal, 'Email cannot be blank.'); return false; }
    if (!isEmailValid(v)) { showError(emailVal, 'Invalid Email.'); return false; }
    showSuccess(emailVal); return true;
};

const checkPhone = () => {
    const v = phoneVal.value.trim();
    if (!isRequired(v)) { showError(phoneVal, 'Phone Number cannot be blank.'); return false; }
    if (!isPhoneValid(v)) { showError(phoneVal, 'Invalid phone number.'); return false; }
    showSuccess(phoneVal); return true;
};

const checkNumberOfAdults = () => {
    const raw = adultVal.value;
    const num = Number(raw);
    if (!isRequired(raw)) { showError(adultVal, 'Number Of Adults cannot be blank.'); return false; }
    if (!Number.isFinite(num) || num < 1 || num > 12 || !Number.isInteger(num)) {
        showError(adultVal, 'Enter a whole number between 1 and 12.');
        return false;
    }
    showSuccess(adultVal); return true;
};

const checkNumberOfChildren = () => {
    const raw = childrenVal.value;
    const num = Number(raw);
    if (!isRequired(raw)) { showError(childrenVal, 'Number Of Children cannot be blank.'); return false; }
    if (!Number.isFinite(num) || num < 0 || num > 12 || !Number.isInteger(num)) {
        showError(childrenVal, 'Enter a whole number between 0 and 12.');
        return false;
    }
    showSuccess(childrenVal); return true;
};

const checkDateAndTimeFilled = () => {
    const raw = dateAndTimeVal.value.trim();
    if (!isRequired(raw)) { showError(dateAndTimeVal, 'Please select a date and time for the tour.'); return false; }
    showSuccess(dateAndTimeVal); return true;
};

const checkPrivateTour = () => {
    const v = (privateTourVal.value ?? '').trim();
    if (!isRequired(v)) { showError(privateTourVal, 'Please choose Yes or No for Private Tour.'); return false; }
    showSuccess(privateTourVal); return true;
};

const checkSpecialRequests = () => {
    const v = specialRequestsVal.value.trim();
    if (!v) { clearStatus(specialRequestsVal); return true; }
    if (v.length > 1000) { showError(specialRequestsVal, 'Special requests must be under 1000 characters.'); return false; }
    showSuccess(specialRequestsVal); return true;
};

const checkCardHolderName = () => {
    const v = cardHolderNameVal.value.trim();
    if (!isRequired(v)) { showError(cardHolderNameVal, "Cardholder's name cannot be blank."); return false; }
    if (/^\d+$/.test(v)) { showError(cardHolderNameVal, "Cardholder's name cannot be a string of numbers."); return false; }
    showSuccess(cardHolderNameVal); return true;
};

/* ===============================
   CARD TYPE + VALIDATION (Luhn)
   =============================== */

function getCardTypeByIIN(cardNumber) {
    const card = (cardNumber || '').replace(/\D/g, '');
    if (!card) return 'unknown';

    const iinData = {
        '36': 'diners',
        '4': 'visa',
        '6011': 'discover',
        '65': 'discover',
        '34': 'american-express',
        '37': 'american-express',
        '62': 'union-pay',
        '5018': 'maestro',
        '5020': 'maestro',
        '5038': 'maestro',
        '5893': 'maestro',
        '6304': 'maestro',
        '6759': 'maestro',
        '6761': 'maestro',
        '6762': 'maestro',
        '6763': 'maestro',
    };

    for (let i = 51; i <= 55; i++) iinData[String(i)] = 'mastercard';
    for (let i = 2221; i <= 2720; i++) iinData[String(i)] = 'mastercard';
    for (let i = 3528; i <= 3589; i++) iinData[String(i)] = 'jcb';
    for (let i = 644; i <= 649; i++) iinData[String(i)] = 'discover';

    let cardNetwork = 'unknown';
    for (let i = 6; i >= 1; i--) {
        const iin = card.slice(0, i);
        if (iinData[iin]) { cardNetwork = iinData[iin]; break; }
    }
    return cardNetwork;
}

function updateCardTypeIcon(cardType) {
    const cardTypeIcon = document.getElementById('selectedCardTypeIcon');
    if (!cardTypeIcon) return;

    cardTypeIcon.classList.remove(
        'visa','mastercard','american-express','diners','discover',
        'union-pay','genericCard','jcb','maestro','unknown'
    );
    cardTypeIcon.classList.add(cardType);

    const modalCardType = document.getElementById('modalCardType');
    if (modalCardType) modalCardType.textContent = cardType;
}

function isValidCardLength(cardType, len) {
    if (cardType === 'visa') return [13, 16, 19].includes(len);
    if (cardType === 'mastercard') return len === 16;
    if (cardType === 'american-express') return len === 15;
    if (cardType === 'discover') return [16, 19].includes(len);
    if (cardType === 'diners') return len === 14;
    if (cardType === 'jcb') return len === 16;
    if (cardType === 'maestro') return len >= 12 && len <= 19;
    if (cardType === 'union-pay') return len >= 16 && len <= 19;
    return false;
}

function isValidCardNumber(cardNumber) {
    const card = (cardNumber || '').replace(/\D/g, '');
    if (!/^[0-9]{13,19}$/.test(card)) return false;

    const cardType = getCardTypeByIIN(card);
    updateCardTypeIcon(cardType);

    const accepted = new Set(['visa','mastercard','maestro','diners','american-express','discover','jcb','union-pay']);
    if (!accepted.has(cardType)) return false;
    if (!isValidCardLength(cardType, card.length)) return false;

    // Luhn
    let sum = 0;
    let doubleUp = false;
    for (let i = card.length - 1; i >= 0; i--) {
        let digit = parseInt(card.charAt(i), 10);
        if (doubleUp) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        doubleUp = !doubleUp;
    }
    return (sum % 10) === 0;
}

const checkCreditCardNumber = () => {
    const raw = digitsOnly(cardNumberVal.dataset.raw || cardNumberVal.value);

    const cardTypeIconsForDisplay = document.getElementById('cardTypeIconsForDisplay');
    const selectedCardTypeIcon = document.getElementById("selectedCardTypeIcon");

    if (!isRequired(raw)) {
        showError(cardNumberVal, "Card Number cannot be blank.");
        if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'block';
        if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'none';
        return false;
    }

    if (!isValidCardNumber(raw)) {
        showError(cardNumberVal, "Please enter a valid card number.");
        if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'block';
        if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'none';
        return false;
    }

    showSuccess(cardNumberVal);
    if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'none';
    if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'block';
    return true;
};

/* Exp + CVV */
function isValidExpirationDate(expirationDate) {
    if (!/^\d{2}\/\d{2}$/.test(expirationDate)) return false;
    const [mm, yy] = expirationDate.split('/');
    const month = parseInt(mm, 10);
    const yearYY = parseInt(yy, 10);
    if (month < 1 || month > 12) return false;

    const now = new Date();
    const currentYY = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (yearYY < currentYY || yearYY > currentYY + 30) return false;
    return !(yearYY === currentYY && month < currentMonth);
}

const checkExpDate = () => {
    const v = expireDateVal.value.trim();
    if (!isRequired(v)) { showError(expireDateVal, "Expiration date cannot be blank."); return false; }
    if (!isValidExpirationDate(v)) { showError(expireDateVal, "Invalid Expiration Date"); return false; }
    showSuccess(expireDateVal); return true;
};

function isValidCVVOrCVC(cvv) {
    const digits = (cvv ?? '').toString().replace(/\D/g, '');
    const rawCard = cardNumberVal.dataset.raw || digitsOnly(cardNumberVal.value);
    const amex = /^3[47]/.test(rawCard);
    return amex ? /^\d{4}$/.test(digits) : /^\d{3}$/.test(digits);
}

const checkCVVOrCVC = () => {
    const v = cvvOrCvcVal.value.trim();
    if (!isRequired(v)) { showError(cvvOrCvcVal, "The CVV/CVC cannot be blank."); return false; }
    if (!isValidCVVOrCVC(v)) { showError(cvvOrCvcVal, "Invalid CVV/CVC number"); return false; }
    showSuccess(cvvOrCvcVal); return true;
};

/* ===============================
   PACKAGE + TRANSPORT (labels)
   =============================== */

function getSelectedTourPackage() {
    const el = document.querySelector('input[name="tourPackage"]:checked');
    if (!el) return null;
    const labelText = el.parentElement?.textContent?.trim() || "";
    return {
        id: el.id,
        label: labelText.replace(/\s+/g, ' ')
    };
}

function getSelectedTransportation() {
    const el =
        document.querySelector('input[name="additionalOption"]:checked') ||
        document.querySelector('input[name^="requiredOption"]:checked');
    if (!el) return null;
    const labelText = el.parentElement?.textContent?.trim() || "";
    return {
        id: el.id,
        label: labelText.replace(/\s+/g, ' ')
    };
}

/* ===============================
   MODAL + SUBMIT FLOW
   =============================== */

let countdownInterval = null;

function startCountdown() {
    const submitButton = document.getElementById('submitFormButton');
    const countdownElement = document.getElementById('countdown');
    let countdown = 10;

    submitButton.disabled = true;
    countdownElement.textContent = `Wait (${countdown}s)`;

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = `Wait (${countdown}s)`;

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            submitButton.disabled = false;
            countdownElement.textContent = 'Submit The Form';
        }
    }, 1000);
}

function updateSelectedPackageAndTransportation() {
    const selectedPackage = document.querySelector('input[name="tourPackage"]:checked');
    const modalSelectedPackage = document.getElementById('modalSelectedPackage');
    const modalSelectedTransportation = document.getElementById('modalSelectedTransportation');

    modalSelectedPackage.textContent = selectedPackage
        ? selectedPackage.parentElement.textContent
        : 'None';

    const selectedTransportationAdditional = document.querySelector('input[name="additionalOption"]:checked');
    const selectedTransportationRequired = document.querySelector('input[name^="requiredOption"]:checked');

    modalSelectedTransportation.textContent =
        (selectedTransportationAdditional || selectedTransportationRequired)
            ? (selectedTransportationAdditional || selectedTransportationRequired).parentElement.textContent
            : 'None';
}

function maskCardNumber() {
    const raw = (cardNumberVal.dataset.raw || cardNumberVal.value).replace(/\D/g, '');
    const maskedRaw = raw.replace(/\d(?=\d{4})/g, '*');
    document.getElementById('modalCardNumber').textContent = formatCardNumberForDisplay(maskedRaw);
}
function maskExp() {
    const exp = expireDateVal.value;
    document.getElementById('modalExpDate').textContent = '*'.repeat(exp.length);
}
function maskCVV() {
    const cvv = cvvOrCvcVal.value;
    document.getElementById('modalCVV').textContent = '*'.repeat(cvv.length);
}

function resetUnmaskLinks() {
    document.querySelectorAll('.unMaskLink').forEach((link) => {
        link.textContent = link.textContent.replace('Hide', 'Reveal');
    });
}

function openModal() {
    const modal = document.getElementById("modal");
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
    document.body.style.overflow = "hidden";

    resetUnmaskLinks();
    startCountdown();

    document.getElementById("modalFirstName").textContent = firstNameVal.value;
    document.getElementById("modalLastName").textContent = lastNameVal.value;
    document.getElementById("modalEmail").textContent = emailVal.value;
    document.getElementById("modalPhoneNumber").textContent = phoneVal.value;
    document.getElementById("modalNumOfAdults").textContent = adultVal.value;
    document.getElementById("modalNumOfChildren").textContent = childrenVal.value;

    updateSelectedPackageAndTransportation();

    document.getElementById("modalDateAndTime").textContent = dateAndTimeVal.value;
    document.getElementById("modalCardholderName").textContent = cardHolderNameVal.value;

    maskCardNumber();
    maskExp();
    maskCVV();

    const totalEl = document.getElementById("totalIncludingTax");
    const totalText = (totalEl?.textContent || "").replace(/[^0-9.]/g, "");
    const totalNumber = Number(totalText || 0);

    document.getElementById("modalMoney").textContent = "$" + (totalText || "0.00");

    const pkg = getSelectedTourPackage();
    const transport = getSelectedTransportation();

    pendingBooking = {
        firstName: firstNameVal.value.trim(),
        lastName: lastNameVal.value.trim(),
        email: emailVal.value.trim(),
        phone: phoneVal.value.trim(),
        dateTime: dateAndTimeVal.value.trim(),
        numAdults: Number(adultVal.value || 0),
        numChildren: Number(childrenVal.value || 0),
        total: totalNumber,
        privateTour: (privateTourVal.value || "").trim(),
        specialRequests: specialRequestsVal.value.trim(),

        tourPackage: pkg?.id || "",
        transportationOption: transport?.id || "",
        tourPackageLabel: pkg?.label || "",
        transportationLabel: transport?.label || "",

        createdAt: new Date().toISOString(),
    };
}

function closeModalToGoBack() {
    const modal = document.getElementById('modal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.style.overflow = 'auto';
}

function showConfirmationModal() {
    document.body.style.overflow = 'hidden';
    document.getElementById('bookingConfirmationModal').style.display = 'block';
}

/* ===============================
   SUBMIT HANDLERS
   =============================== */

form.addEventListener('submit', function (e) {
    e.preventDefault();

    const errors = [];
    const add = (ok, label) => { if (!ok) errors.push(label); return ok; };

    // must pick package
    const picked = Array.from(document.querySelectorAll('input[name="tourPackage"]')).some(r => r.checked);
    const tourPackageError = document.getElementById('tourPackageError');
    if (tourPackageError) tourPackageError.style.display = picked ? 'none' : 'block';
    if (!picked) errors.push('Tour package');

    add(checkFirstName(), 'First name');
    add(checkLastName(), 'Last name');
    add(checkEmail(), 'Email');
    add(checkPhone(), 'Phone number');
    add(checkNumberOfAdults(), 'Number of adults');
    add(checkNumberOfChildren(), 'Number of children');
    add(checkDateAndTimeFilled(), 'Date and time of tour');
    add(checkPrivateTour(), 'Private tour');
    add(checkSpecialRequests(), 'Additional comments / special requests');
    add(checkCardHolderName(), 'Cardholder name');
    add(checkCreditCardNumber(), 'Card number');
    add(checkExpDate(), 'Expiration date');
    add(checkCVVOrCVC(), 'Security code');

    const uniqueErrors = [...new Set(errors)];

    if (uniqueErrors.length === 0) {
        openModal();
        return;
    }

    if (typeof displayErrorToast === 'function') {
        displayErrorToast(
            `There are errors found in your submission.\n\n${uniqueErrors.map(e => `- ${e}`).join('\n')}\n\nPlease fix them.`
        );
    }
});

document.getElementById('submitFormButton')?.addEventListener('click', async function () {
    const btn = document.getElementById('submitFormButton');
    const countdownEl = document.getElementById('countdown');
    if (!btn || !countdownEl) return;

    if (btn.dataset.submitting === "1") return;

    const prevText = countdownEl.textContent;

    btn.dataset.submitting = "1";
    btn.disabled = true;
    countdownEl.textContent = "Submitting...";

    try {
        if (!window.NYCINFO_API) throw new Error('API helper missing (js/api.js).');
        if (!pendingBooking) throw new Error("No booking payload found. Please review the form again.");

        await window.NYCINFO_API.postBooking(pendingBooking);

        const modal = document.getElementById('modal');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';

        setTimeout(() => showConfirmationModal(), 1200);
    } catch (err) {
        const msg = err?.message || 'Booking submission failed. Please try again.';
        if (typeof displayErrorToast === 'function') displayErrorToast(msg);

        btn.disabled = false;
        countdownEl.textContent = prevText || "Submit The Form";
    } finally {
        btn.dataset.submitting = "0";
    }
});

document.getElementById('backButton')?.addEventListener('click', function () {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    closeModalToGoBack();
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('closeConfirmationModal')?.addEventListener('click', function () {
    const confirmationModal = document.getElementById('bookingConfirmationModal');
    confirmationModal.style.display = 'none';
    setTimeout(() => location.reload(), 300);
});
