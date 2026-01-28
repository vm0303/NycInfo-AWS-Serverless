/* ===============================
   INPUT RESTRICTIONS (keypress)
   =============================== */

function getChar(evt) {
    if (evt.key != null) return evt.key; // best case
    const code = evt.which || evt.keyCode;
    return String.fromCharCode(code);
}

function isNumber(evt) {
    evt = evt || window.event;
    const ch = getChar(evt);
    // digits, +, -
    return /^[0-9+\-]$/.test(ch);
}

function expDateRestriction(evt) {
    evt = evt || window.event;
    const ch = getChar(evt);
    // digits or /
    return /^[0-9/]$/.test(ch);
}

function isJustNumber(evt) {
    evt = evt || window.event;
    const k = evt.key;

    // If key is missing (older browsers), fallback
    if (!k) {
        const ch = getChar(evt);
        return /^[0-9]$/.test(ch);
    }

    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(k)) return true;
    return /^[0-9]$/.test(k);
}

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
let cardNumberVal = document.querySelector('#cardNumber');
let expireDateVal = document.querySelector("#expirationDate");
let cvvOrCvcVal = document.querySelector("#securityCode");
const specialRequestsVal = document.querySelector('#specialRequests');

const form = document.querySelector('#bookTour');
let pendingBooking = null;

/* ===============================
   HELPERS (digits, formatting)
   =============================== */

function digitsOnly(s) {
    return (s ?? '').toString().replace(/\D/g, '');
}

// detect AMEX by IIN (34 or 37)
function isAmexDigits(d) {
    return /^3[47]/.test(d);
}

function formatCardNumberForDisplay(rawDigits) {
    const d = rawDigits || '';
    if (isAmexDigits(d)) {
        // AMEX: 15 digits => 4-6-5
        const p1 = d.slice(0, 4);
        const p2 = d.slice(4, 10);
        const p3 = d.slice(10, 15);
        return [p1, p2, p3].filter(Boolean).join(' ');
    }
    // Default: group by 4
    return d.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpForDisplay(digits) {
    // digits is MMYY (0-4 chars)
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + '/' + digits.slice(2, 4);
}

/* ===============================
   LIVE PAYMENT INPUT SANITIZERS
   =============================== */

// Card Number: format visually, store raw digits, max 19 (AMEX 15)
cardNumberVal.addEventListener('input', (e) => {
    const el = e.target;

    const digits = digitsOnly(el.value);
    const maxLen = isAmexDigits(digits) ? 15 : 19;
    const raw = digits.slice(0, maxLen);
    el.dataset.raw = raw;

    // ✅ live update icon while typing
    updateCardTypeIcon(getCardTypeByIIN(raw));

    const formatted = formatCardNumberForDisplay(raw);

    // Keep cursor reasonably stable
    const prevPos = el.selectionStart ?? formatted.length;
    const prevLen = el.value.length;

    if (el.value !== formatted) el.value = formatted;

    const newLen = el.value.length;
    const delta = newLen - prevLen;
    const nextPos = Math.max(0, Math.min(newLen, prevPos + delta));
    try { el.setSelectionRange(nextPos, nextPos); } catch (_) {}

    // Update CVV limit dynamically based on card type
    const amex = isAmexDigits(raw);
    const maxCvv = amex ? 4 : 3;
    cvvOrCvcVal.maxLength = maxCvv;

    // Trim CVV if too long
    const cvvRaw = digitsOnly(cvvOrCvcVal.value);
    if (cvvRaw.length > maxCvv) cvvOrCvcVal.value = cvvRaw.slice(0, maxCvv);
});

// CVV/CVC: digits only; 3 for most, 4 for AMEX
cvvOrCvcVal.addEventListener('input', (e) => {
    const el = e.target;

    const rawCard = cardNumberVal.dataset.raw || digitsOnly(cardNumberVal.value);
    const maxCvv = isAmexDigits(rawCard) ? 4 : 3;

    const rawCvv = digitsOnly(el.value).slice(0, maxCvv);
    if (el.value !== rawCvv) el.value = rawCvv;
});

// Expiration: auto-format MM/YY, digits only
expireDateVal.addEventListener('input', (e) => {
    const el = e.target;
    const raw = digitsOnly(el.value).slice(0, 4); // MMYY
    const formatted = formatExpForDisplay(raw);

    const prevPos = el.selectionStart ?? formatted.length;
    const prevLen = el.value.length;

    if (el.value !== formatted) el.value = formatted;

    const newLen = el.value.length;
    const delta = newLen - prevLen;
    const nextPos = Math.max(0, Math.min(newLen, prevPos + delta));
    try { el.setSelectionRange(nextPos, nextPos); } catch (_) {}
});

/* ===============================
   VALIDATION HELPERS
   =============================== */

const isRequired = value => (value ?? '').toString().trim() !== '';
const maxLimit = (length, max) => !(length > max);

const isEmailValid = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};

function normalizePhone(raw) {
    return (raw || '').toString().trim();
}

function isPhoneValid(phone) {
    const value = normalizePhone(phone);
    if (!value) return false;

    // libphonenumber-js (loaded via CDN) creates window.libphonenumber
    const lib = window.libphonenumber;
    if (lib && typeof lib.parsePhoneNumberFromString === 'function') {
        try {
            // If user includes +, parse as international. Otherwise, default to US (keeps legacy behavior).
            const parsed = value.startsWith('+')
                ? lib.parsePhoneNumberFromString(value)
                : lib.parsePhoneNumberFromString(value, 'US');

            return !!parsed && typeof parsed.isValid === 'function' && parsed.isValid();
        } catch (_) {
            return false;
        }
    }

    // Fallback (should be rare): allow 8..15 digits
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
}

const isInRange = (value, min, max) => value >= min && value <= max;

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
    const firstName = firstNameVal.value.trim();
    if (!isRequired(firstName)) { showError(firstNameVal, 'First Name cannot be blank.'); return false; }
    showSuccess(firstNameVal); return true;
};

const checkLastName = () => {
    const lastName = lastNameVal.value.trim();
    if (!isRequired(lastName)) { showError(lastNameVal, 'Last Name cannot be blank.'); return false; }
    showSuccess(lastNameVal); return true;
};

const checkEmail = () => {
    const email = emailVal.value.trim();
    const max = 254;
    if (!isRequired(email)) { showError(emailVal, 'Email cannot be blank.'); return false; }
    if (!isEmailValid(email)) { showError(emailVal, 'Invalid Email.'); return false; }
    if (!maxLimit(email.length, max)) { showError(emailVal, 'Email has too many characters.'); return false; }
    showSuccess(emailVal); return true;
};

const checkPhone = () => {
    const phone = phoneVal.value.trim();
    const max = 15;
    if (!isRequired(phone)) { showError(phoneVal, 'Phone Number cannot be blank.'); return false; }
    if (!maxLimit(phone.length, max)) {
        showError(phoneVal, `The max number of digits on a phone number is ${max} (including the + and - symbols).`);
        return false;
    }
    if (!isPhoneValid(phone)) { showError(phoneVal, 'Invalid phone number.'); return false; }
    showSuccess(phoneVal); return true;
};

const checkNumberOfAdults = () => {
    const raw = adultVal.value;
    const min = 1, max = 12;

    if (!isRequired(raw)) { showError(adultVal, 'Number Of Adults cannot be blank.'); return false; }
    const num = Number(raw);
    if (!Number.isFinite(num) || !isInRange(num, min, max)) { showError(adultVal, `Enter a number between ${min} and ${max}.`); return false; }
    if (!Number.isInteger(num)) {
        showError(adultVal, 'Please enter a whole number.');
        return false;
    }
    showSuccess(adultVal); return true;
};

const checkNumberOfChildren = () => {
    const raw = childrenVal.value;
    const min = 0, max = 12;

    if (!isRequired(raw)) { showError(childrenVal, 'Number Of Children cannot be blank.'); return false; }
    const num = Number(raw);
    if (!Number.isFinite(num) || !isInRange(num, min, max)) { showError(childrenVal, `Enter a number between ${min} and ${max}.`); return false; }
    if (!Number.isInteger(num)) { showError(childrenVal, 'Please enter a whole number.'); return false; }

    showSuccess(childrenVal);
    return true;
};

function parseTourDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

const checkDateAndTimeFilled = () => {
    const raw = dateAndTimeVal.value.trim();
    if (!isRequired(raw)) { showError(dateAndTimeVal, 'Please select a date and time for the tour.'); return false; }

    const d = parseTourDate(raw);
    if (!d) { showError(dateAndTimeVal, 'That date/time doesn’t look valid.'); return false; }

    // Personal-project friendly: enforce "future" (15 min buffer)
    const minMs = 15 * 60 * 1000;
    if (d.getTime() < Date.now() + minMs) { showError(dateAndTimeVal, 'Please choose a time in the future.'); return false; }

    showSuccess(dateAndTimeVal);
    return true;
};

const checkPrivateTour = () => {
    const v = (privateTourVal.value ?? '').toString().trim();
    if (!isRequired(v)) { showError(privateTourVal, 'Please choose Yes or No for Private Tour.'); return false; }
    showSuccess(privateTourVal); return true;
};

// Special Requests (optional)
const checkSpecialRequests = () => {
    const v = specialRequestsVal.value.trim();
    const max = 1000;
    if (v === '') { clearStatus(specialRequestsVal); return true; }
    if (!maxLimit(v.length, max)) { showError(specialRequestsVal, `Special requests must be under ${max} characters.`); return false; }
    showSuccess(specialRequestsVal); return true;
};

const checkCardHolderName = () => {
    const cardHolderName = cardHolderNameVal.value.trim();
    const numberRegex = /^\d+$/;
    if (!isRequired(cardHolderName)) { showError(cardHolderNameVal, "Cardholder's name cannot be blank."); return false; }
    if (numberRegex.test(cardHolderName)) { showError(cardHolderNameVal, "Cardholder's name cannot be a string of numbers."); return false; }
    showSuccess(cardHolderNameVal); return true;
};

/* ===============================
   CARD TYPE + VALIDATION (Luhn)
   =============================== */

function getCardTypeByIIN(cardNumber) {
    cardNumber = cardNumber.replace(/\D/g, '');

    const iinData = {
        '36': 'diners',
        '4': 'visa',
        '51': 'mastercard',
        '52': 'mastercard',
        '53': 'mastercard',
        '54': 'mastercard',
        '55': 'mastercard',
        '6011': 'discover',
        '644': 'discover',
        '645': 'discover',
        '646': 'discover',
        '647': 'discover',
        '648': 'discover',
        '649': 'discover',
        '65': 'discover',
        '34': 'american-express',
        '37': 'american-express',
        '62': 'union-pay',
        '636': 'genericCard',
        '637': 'genericCard',
        '638': 'genericCard',
        '639': 'genericCard',
        '5018': 'maestro',
        '5020': 'maestro',
        '5038': 'maestro',
        '5893': 'maestro',
        '6304': 'maestro',
        '6759': 'maestro',
        '6761': 'maestro',
        '6762': 'maestro',
        '6763': 'maestro',
        '9792': 'discover'
    };

    for (let i = 3528; i <= 3589; i++) iinData[i.toString()] = 'jcb';
    for (let i = 2221; i <= 2720; i++) iinData[i.toString()] = 'mastercard';

    // allow partial typing: if empty -> unknown
    if (!cardNumber) return 'unknown';

    let cardNetwork = 'unknown';
    // try 6..1 digit prefix
    for (let i = 6; i >= 1; i--) {
        const iin = cardNumber.slice(0, i);
        if (iinData[iin]) { cardNetwork = iinData[iin]; break; }
    }
    return cardNetwork;
}

function updateCardTypeIcon(cardType) {
    const cardTypeIcon = document.getElementById('selectedCardTypeIcon');
    if (!cardTypeIcon) return;

    cardTypeIcon.classList.remove(
        'visa', 'mastercard', 'american-express', 'diners', 'discover',
        'union-pay', 'genericCard', 'jcb', 'maestro', 'unknown'
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
    cardNumber = cardNumber.replace(/\D/g, '');
    const regex = /^[0-9]{13,19}$/;
    if (!regex.test(cardNumber)) return false;

    const cardType = getCardTypeByIIN(cardNumber);
    updateCardTypeIcon(cardType);

    const acceptedTypes = new Set([
        'visa','mastercard','maestro','diners','american-express','discover','jcb','union-pay'
    ]);
    if (!acceptedTypes.has(cardType)) return false;

    if (!isValidCardLength(cardType, cardNumber.length)) return false;

    let sum = 0;
    let doubleUp = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i), 10);
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
    const cardNumber = digitsOnly(cardNumberVal.dataset.raw || cardNumberVal.value);

    const cardTypeIconsForDisplay = document.getElementById('cardTypeIconsForDisplay');
    const selectedCardTypeIcon = document.getElementById("selectedCardTypeIcon");

    const cardType = getCardTypeByIIN(cardNumber);

    if (!isRequired(cardNumber)) {
        showError(cardNumberVal, "Card Number cannot be blank.");
        if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'block';
        if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'none';
        return false;
    }

    if (!isValidCardNumber(cardNumber)) {
        showError(cardNumberVal, "Please enter a valid card number.");
        if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'block';
        if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'none';
        return false;
    }

    if (cardType === 'unknown') {
        showError(cardNumberVal, "Sorry, but we don't support that card number for payment.");
        if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'block';
        if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'none';
        return false;
    }

    showSuccess(cardNumberVal);
    if (cardTypeIconsForDisplay) cardTypeIconsForDisplay.style.display = 'none';
    if (selectedCardTypeIcon) selectedCardTypeIcon.style.display = 'block';
    return true;
};

function maskCardNumber() {
    const raw = (cardNumberVal.dataset.raw || document.getElementById('cardNumber').value).replace(/\D/g, '');
    const maskedRaw = raw.replace(/\d(?=\d{4})/g, '*');
    document.getElementById('modalCardNumber').textContent = formatCardNumberForDisplay(maskedRaw);
}

/* ===============================
   EXPIRATION + CVV VALIDATION
   =============================== */

const checkExpDate = () => {
    const expirationDate = expireDateVal.value.trim();
    if (!isRequired(expirationDate)) { showError(expireDateVal, "Expiration date cannot be blank."); return false; }
    if (!isValidExpirationDate(expirationDate)) { showError(expireDateVal, "Invalid Expiration Date"); return false; }
    showSuccess(expireDateVal); return true;
};

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

function maskExp() {
    const exp = document.getElementById('expirationDate').value;
    document.getElementById('modalExpDate').textContent = '*'.repeat(exp.length);
}

const checkCVVOrCVC = () => {
    const cvvOrCvc = cvvOrCvcVal.value.trim();
    if (!isRequired(cvvOrCvc)) { showError(cvvOrCvcVal, "The CVV/CVC cannot be blank."); return false; }
    if (!isValidCVVOrCVC(cvvOrCvc)) { showError(cvvOrCvcVal, "Invalid CVV/CVC number"); return false; }
    showSuccess(cvvOrCvcVal); return true;
};

function maskCVV() {
    const cvv = document.getElementById('securityCode').value;
    document.getElementById('modalCVV').textContent = '*'.repeat(cvv.length);
}

function isValidCVVOrCVC(cvv) {
    const digits = (cvv ?? '').toString().replace(/\D/g, '');
    const rawCard = cardNumberVal.dataset.raw || (cardNumberVal.value || '').replace(/\D/g, '');
    const amex = /^3[47]/.test(rawCard);
    return amex ? /^\d{4}$/.test(digits) : /^\d{3}$/.test(digits);
}

/* ===============================
   MODAL OPEN/CLOSE + MASK TOGGLES
   =============================== */

function getSelectedTourPackage() {
    const el = document.querySelector('input[name="tourPackage"]:checked');
    if (!el) return null;

    const labelText = el.parentElement?.textContent?.trim() || "";
    return {
        id: el.id,
        pricePerPerson: Number(el.value || 0),
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
        pricePerPerson: Number(el.value || 0),
        label: labelText.replace(/\s+/g, ' ')
    };
}

function openModal() {
    const requiredIds = [
        "modal",
        "modalFirstName","modalLastName","modalEmail","modalPhoneNumber",
        "modalNumOfAdults","modalNumOfChildren",
        "modalSelectedPackage","modalSelectedTransportation",
        "modalDateAndTime","modalCardholderName",
        "modalCardNumber","modalExpDate","modalCVV","modalMoney",
        "totalIncludingTax"
    ];

    const missing = requiredIds.filter(id => !document.getElementById(id));
    if (missing.length) {
        console.error("Modal is missing elements:", missing);
        return;
    }

    const modal = document.getElementById("modal");
    const menuButton = document.querySelector(".btn-menu");
    if (menuButton) {
        menuButton.style.pointerEvents = "none";
        menuButton.style.opacity = "0";
    }

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
    const totalText = (totalEl.textContent || "").replace(/[^0-9.]/g, "");
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

        // IDs
        tourPackage: pkg?.id || "",
        transportationOption: transport?.id || "",

        // ✅ labels for Lambda email
        tourPackageLabel: pkg?.label || "",
        transportationLabel: transport?.label || "",

        createdAt: new Date().toISOString(),
    };
}

function showConfirmationModal() {
    const menuButton = document.querySelector('.btn-menu');
    if (menuButton) {
        menuButton.style.pointerEvents = 'none';
        menuButton.style.opacity = '0';
    }
    document.body.style.overflow = 'hidden';
    const confirmationModal = document.getElementById('bookingConfirmationModal');
    confirmationModal.style.display = 'block';
}

function closeModalToGoBack() {
    const modal = document.getElementById('modal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.style.overflow = 'auto';

    const menuButton = document.querySelector('.btn-menu');
    if (menuButton) {
        menuButton.style.pointerEvents = 'auto';
        menuButton.style.opacity = '1';
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => showConfirmationModal(), 1200);
}

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

let isMasked = true;
function toggleMasking(inputId, modalId, unmaskLinkId) {
    const inputElement = document.getElementById(inputId);
    const modalElement = document.getElementById(modalId);
    const unmaskLink = document.getElementById(unmaskLinkId);

    if (unmaskLink.textContent.includes('Reveal')) {
        isMasked = false;
        unmaskLink.textContent = unmaskLink.textContent.replace('Reveal', 'Hide');

        if (inputId === 'cardNumber') {
            const raw = (cardNumberVal.dataset.raw || '').replace(/\D/g, '');
            modalElement.textContent = formatCardNumberForDisplay(raw);
        } else {
            modalElement.textContent = inputElement.value;
        }
    } else {
        isMasked = true;
        unmaskLink.textContent = unmaskLink.textContent.replace('Hide', 'Reveal');
        if (inputId === 'cardNumber') maskCardNumber();
        else if (inputId === 'expirationDate') maskExp();
        else if (inputId === 'securityCode') maskCVV();
    }
}

function resetUnmaskLinks() {
    const unmaskLinks = document.querySelectorAll('.unMaskLink');
    unmaskLinks.forEach((link) => {
        link.textContent = link.textContent.replace('Hide', 'Reveal');
    });
}

/* ===============================
   TOUR PACKAGE + TRANSPORTATION
   =============================== */

const additionalOptions = document.getElementById("additionalOptions");
const additionalOptions2 = document.getElementById("additionalOptions2");
const additionalOptions3 = document.getElementById("additionalOptions3");
const additionalOptions4 = document.getElementById("additionalOptions4");
const additionalOptions5 = document.getElementById("additionalOptions5");

function selectOnlyThis(id) {
    if (additionalOptions) additionalOptions.style.display = "none";
    if (additionalOptions2) additionalOptions2.style.display = "none";
    if (additionalOptions3) additionalOptions3.style.display = "none";
    if (additionalOptions4) additionalOptions4.style.display = "none";
    if (additionalOptions5) additionalOptions5.style.display = "none";

    if (id === "cf1" && additionalOptions) additionalOptions.style.display = "block";
    if (id === "cf2" && additionalOptions2) additionalOptions2.style.display = "block";
    if (id === "cf3" && additionalOptions3) additionalOptions3.style.display = "block";
    if (id === "cf4" && additionalOptions4) additionalOptions4.style.display = "block";
    if (id === "cf5" && additionalOptions5) additionalOptions5.style.display = "block";

    hideTransportationError(0);
    hideTransportationError(1);
    hideTransportationError(2);

    additionalOptionsCheckboxes.forEach(opt => {
        if (!additionalOptionsMap[id].includes(opt.id)) opt.checked = false;
    });

    updateTotal();

    const tourPackageError = document.getElementById('tourPackageError');
    if (tourPackageError) tourPackageError.style.display = 'none';
}

function selectThisAdditional() {
    updateTotal();
}

// kept for compatibility with old code, but not required
let transportationOptionSelected = [false, false, false];

function selectThisRequiredOne(id) { toggleTransportationOption(0, id); }
function selectThisRequiredTwo(id) { toggleTransportationOption(1, id); }
function selectThisRequiredThree(id) { toggleTransportationOption(2, id); }

// Required option selected => clear error + recalc totals
function toggleTransportationOption(packageIndex) {
    hideTransportationError(packageIndex);
    updateTotal();
}

function displayTransportationError(packageIndex) {
    const el = document.getElementById("transportationError" + (packageIndex + 1));
    if (el) el.style.display = "block";
}

function hideTransportationError(packageIndex) {
    const el = document.getElementById("transportationError" + (packageIndex + 1));
    if (el) el.style.display = "none";
}

const handleRequiredTransportationError1 = () => {
    let form_data = new FormData(form);
    if (!form_data.has("requiredOption1")) {
        document.getElementById("transportationError1").style.display = "block";
        return false;
    }
    document.getElementById("transportationError1").style.display = "none";
    return true;
};

const handleRequiredTransportationError2 = () => {
    let form_data = new FormData(form);
    if (!form_data.has("requiredOption2")) {
        document.getElementById("transportationError2").style.display = "block";
        return false;
    }
    document.getElementById("transportationError2").style.display = "none";
    return true;
};

const handleRequiredTransportationError3 = () => {
    let form_data = new FormData(form);
    if (!form_data.has("requiredOption3")) {
        document.getElementById("transportationError3").style.display = "block";
        return false;
    }
    document.getElementById("transportationError3").style.display = "none";
    return true;
};

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

/* ===============================
   TOTALS
   =============================== */

const nySalesTaxRate = 0.045;

const totalWithoutTaxElement = document.getElementById('totalWithoutTax');
const totalWithoutTaxElement2 = document.getElementById('totalWithoutTax2');
const totalIncludingTaxElement = document.getElementById('totalIncludingTax');
const salesTaxElement = document.getElementById('salesTax');

const tourPackageCheckboxes = Array.from(document.querySelectorAll('input[name="tourPackage"]'));

const additionalOptionsCheckboxes = Array.from(document.querySelectorAll(
    'input[name="additionalOption"], input[name="requiredOption1"], input[name="requiredOption2"], input[name="requiredOption3"]'
));

const additionalOptionsMap = {
    "cf1": ["ao1", "ao2"],
    "cf2": ["ao3", "ao4", "ao5"],
    "cf3": ["co1", "co2", "co3"],
    "cf4": ["vo1", "vo2", "vo3"],
    "cf5": ["uo1", "uo2", "uo3"]
};

function updateTotal() {
    let base = 0;

    const adults = Number(adultVal.value) || 0;
    const kids = Number(childrenVal.value) || 0;
    const people = adults + kids;

    tourPackageCheckboxes.forEach(cb => { if (cb.checked) base += Number(cb.value); });
    additionalOptionsCheckboxes.forEach(cb => { if (cb.checked) base += Number(cb.value); });

    const subtotal = base * people;
    const tax = subtotal * nySalesTaxRate;
    const total = subtotal + tax;

    if (totalWithoutTaxElement) totalWithoutTaxElement.textContent = subtotal.toFixed(2);
    if (totalWithoutTaxElement2) totalWithoutTaxElement2.textContent = subtotal.toFixed(2);
    if (salesTaxElement) salesTaxElement.textContent = tax.toFixed(2);
    if (totalIncludingTaxElement) totalIncludingTaxElement.textContent = total.toFixed(2);
}

/* ===============================
   SUBMIT + LIVE VALIDATION
   =============================== */

form.addEventListener('submit', function (e) {
    e.preventDefault();

    const errors = [];
    const add = (ok, label) => {
        if (!ok) errors.push(label);
        return ok;
    };

    // 1) Must pick a tour package
    const isTourPackageChecked = tourPackageCheckboxes.some(cb => cb.checked);
    const tourPackageError = document.getElementById('tourPackageError');
    if (tourPackageError) tourPackageError.style.display = isTourPackageChecked ? 'none' : 'block';
    if (!isTourPackageChecked) errors.push('Tour package');

    // 2) Run validations (DON’T short-circuit; we want ALL errors)
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

    // 3) Conditional transportation requirement
    let transportationValid = true;
    const tp3Picked = document.getElementById('cf3')?.checked;
    const tp4Picked = document.getElementById('cf4')?.checked;
    const tp5Picked = document.getElementById('cf5')?.checked;

    if (tp3Picked) transportationValid = handleRequiredTransportationError1();
    if (tp4Picked) transportationValid = handleRequiredTransportationError2();
    if (tp5Picked) transportationValid = handleRequiredTransportationError3();

    if (!transportationValid) errors.push('Transportation option');

    const uniqueErrors = [...new Set(errors)];

    if (uniqueErrors.length === 0) {
        openModal();
        return;
    }

    if (typeof displayErrorToast === 'function') {
        const lines = uniqueErrors.map(e => `- ${e}`).join('\n');
        displayErrorToast(
            `There are errors found in your submission.\n\n${lines}\n\nPlease fix them.`
        );
    }
});

document.getElementById('submitFormButton')?.addEventListener('click', async function () {
    const btn = document.getElementById('submitFormButton');
    const countdownEl = document.getElementById('countdown');

    if (!btn || !countdownEl) return;

    // prevent double submits
    if (btn.dataset.submitting === "1") return;

    const prevText = countdownEl.textContent;

    btn.dataset.submitting = "1";
    btn.disabled = true;
    countdownEl.textContent = "Submitting...";

    try {
        if (!window.NYCINFO_API) throw new Error('API helper missing (js/api.js).');
        const payload = pendingBooking;
        if (!payload) throw new Error("No booking payload found. Please review the form again.");

        await window.NYCINFO_API.postBooking(payload);

        // success
        const modal = document.getElementById('modal');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        setTimeout(() => showConfirmationModal(), 1200);
    } catch (err) {
        const msg = (err && err.message) ? err.message : 'Booking submission failed. Please try again.';
        if (typeof displayErrorToast === 'function') displayErrorToast(msg);

        // restore button state if failed
        btn.disabled = false;
        countdownEl.textContent = prevText || "Submit The Form";
    } finally {
        btn.dataset.submitting = "0";
    }
});

document.getElementById('closeConfirmationModal')?.addEventListener('click', function () {
    const confirmationModal = document.getElementById('bookingConfirmationModal');
    confirmationModal.style.display = 'none';
    setTimeout(() => {
        window.onbeforeunload = function () { window.scrollTo(0, 0); };
        location.reload();
    }, 300);
});

const debounce = (fn, delay = 400) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
};

form.addEventListener('input', debounce(function (e) {
    switch (e.target.id) {
        case 'f_name': checkFirstName(); break;
        case 'l_name': checkLastName(); break;
        case 'email': checkEmail(); break;
        case 'phone': checkPhone(); break;
        case 'numOfAdultsInput': checkNumberOfAdults(); updateTotal(); break;
        case 'numOfChildrenInput': checkNumberOfChildren(); updateTotal(); break;
        case 'theDateAndTimeInput': checkDateAndTimeFilled(); break;
        case 'privateTour': checkPrivateTour(); break;
        case 'specialRequests': checkSpecialRequests(); break;
        case 'cardHolderName': checkCardHolderName(); break;
        case 'cardNumber': checkCreditCardNumber(); break;
        case 'expirationDate': checkExpDate(); break;
        case 'securityCode': checkCVVOrCVC(); break;
    }
}));

document.getElementById('backButton')?.addEventListener('click', function () {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    closeModalToGoBack();

    const modalContent = document.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
});

/* Floating label support */
function setupInputField(inputElement) {
    if (!inputElement) return;

    const toggleValid = () => {
        const v = (inputElement.value ?? '').toString().trim();
        if (v === '') inputElement.classList.remove('valid');
        else inputElement.classList.add('valid');
    };

    inputElement.addEventListener('focus', function () {
        inputElement.classList.add('focused');
    });

    inputElement.addEventListener('blur', function () {
        validateInput(inputElement);
        inputElement.classList.remove('focused');
    });

    inputElement.addEventListener('input', toggleValid);

    inputElement.addEventListener('change', function () {
        toggleValid();
        validateInput(inputElement);
    });

    toggleValid();
}

function validateInput(inputElement) {
    switch (inputElement.id) {
        case 'f_name': checkFirstName(); break;
        case 'l_name': checkLastName(); break;
        case 'email': checkEmail(); break;
        case 'phone': checkPhone(); break;
        case 'numOfAdultsInput': checkNumberOfAdults(); break;
        case 'numOfChildrenInput': checkNumberOfChildren(); break;
        case 'theDateAndTimeInput': checkDateAndTimeFilled(); break;
        case 'privateTour': checkPrivateTour(); break;
        case 'specialRequests': checkSpecialRequests(); break;
        case 'cardHolderName': checkCardHolderName(); break;
        case 'cardNumber': checkCreditCardNumber(); break;
        case 'expirationDate': checkExpDate(); break;
        case 'securityCode': checkCVVOrCVC(); break;
    }
}

[
    firstNameVal, lastNameVal, emailVal, phoneVal,
    adultVal, childrenVal, dateAndTimeVal, privateTourVal,
    cardHolderNameVal, cardNumberVal, expireDateVal, cvvOrCvcVal,
    specialRequestsVal
].forEach(setupInputField);

/* Hook totals to changes */
tourPackageCheckboxes.forEach(radio => {
    radio.addEventListener('change', () => {
        const selected = document.querySelector('input[name="tourPackage"]:checked');
        const selectedId = selected ? selected.id : null;

        const tourPackageError = document.getElementById('tourPackageError');
        if (tourPackageError) tourPackageError.style.display = selected ? 'none' : 'block';

        // Always clear old transportation errors when switching packages
        hideTransportationError(0);
        hideTransportationError(1);
        hideTransportationError(2);

        // Clear any previously selected transportation radios from other packages
        additionalOptionsCheckboxes.forEach(opt => {
            if (!selectedId || !(additionalOptionsMap[selectedId] || []).includes(opt.id)) {
                opt.checked = false;
            }
        });

        updateTotal();
    });
});

additionalOptionsCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateTotal));
adultVal.addEventListener('input', updateTotal);
childrenVal.addEventListener('input', updateTotal);

updateTotal();

/* ===============================
   EVENT WIRING (no inline onclick)
   =============================== */
document.addEventListener('DOMContentLoaded', () => {
    // Private Tour select: switch placeholder color vs selected value
    const privateTourSelect = document.getElementById('privateTour');
    if (privateTourSelect) {
        const updateSelectStyle = () => {
            privateTourSelect.classList.toggle('has-value', !!privateTourSelect.value);
        };
        updateSelectStyle();
        privateTourSelect.addEventListener('change', updateSelectStyle);
    }

    // Tour package radios
    document.querySelectorAll('input[name="tourPackage"]').forEach((el) => {
        el.addEventListener('change', () => selectOnlyThis(el.id));
    });

    // Additional options
    document.querySelectorAll('input[name="additionalOption"]').forEach((el) => {
        el.addEventListener('change', () => selectThisAdditional());
    });

    // Required transportation options (3 groups)
    document.querySelectorAll('input[name="requiredOption1"]').forEach((el) => {
        el.addEventListener('change', () => toggleTransportationOption(0));
    });
    document.querySelectorAll('input[name="requiredOption2"]').forEach((el) => {
        el.addEventListener('change', () => toggleTransportationOption(1));
    });
    document.querySelectorAll('input[name="requiredOption3"]').forEach((el) => {
        el.addEventListener('change', () => toggleTransportationOption(2));
    });

    // Modal reveal/hide links
    const bindReveal = (linkId, inputId, modalId) => {
        const link = document.getElementById(linkId);
        if (!link) return;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMasking(inputId, modalId, linkId);
        });
    };

    bindReveal('cardNumberUnmask', 'cardNumber', 'modalCardNumber');
    bindReveal('expDateUnmask', 'expirationDate', 'modalExpDate');
    bindReveal('cvvUnmask', 'securityCode', 'modalCVV');
});
