/**
 * RONAV TECHNOLOGIES — Single Authoritative Error Message Layer
 * 
 * Maps every server error code and message to a short plain-English sentence
 * a shopkeeper understands: what happened and what to do next.
 * 
 * Rules:
 * - No raw codes, user IDs, or unexplained technical terms like "mode" or "T1".
 * - Raw codes and technical messages are logged exclusively to the console.
 * - Unknown or unmapped errors fallback to:
 *   "Something went wrong. Please try again or contact support."
 */

export const DEFAULT_UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again or contact support.';

export const ERROR_CODE_MAP = {
  // Authentication & Access
  AUTH_TOKEN_MISSING: 'You are not logged in. Please log in with your User ID and password.',
  AUTH_TOKEN_INVALID: 'Your session could not be verified. Please log in again with your User ID and password.',
  AUTH_TOKEN_EXPIRED: 'Your login session has expired. Please log in again to continue.',
  AUTH_TOKEN_REQUIRED: 'You must be logged in to perform this action. Please log in and try again.',
  ACCESS_DENIED: 'You do not have permission to access this feature. Please contact support if you need access.',
  ACCESS_FORBIDDEN: 'You do not have permission to view or modify this account. Please return to your dashboard or contact your distributor.',
  FORBIDDEN_ADMIN_ONLY: 'This area is restricted to system administrators only. Please log in with an administrator account.',
  PASSWORD_REQUIRED: 'Please enter your password to continue.',
  CANNOT_GENERATE_TOKEN: 'Could not create user login session. Please try logging in again.',
  USER_NOT_FOUND: 'No account was found with those details. Please double-check the User ID or mobile number.',
  USER_SUSPENDED: 'Your account has been temporarily suspended. Please contact customer support for assistance.',
  RATE_LIMIT_EXCEEDED: 'Too many requests sent in a short time. Please wait one minute and try again.',
  CALLER_IDENTIFICATION_REQUIRED: 'Your user details were not recognized. Please log out and log back in.',
  WEBHOOK_UNAUTHORIZED: 'Unauthorized system trigger. Access is denied.',

  // Card Swipes & Transactions
  ADMIN_CANNOT_SWIPE: 'Administrator accounts cannot record card swipes. Please log in with your merchant account to accept customer payments.',
  CHANNEL_REQUIRED: 'Payment machine type is required (Pine Labs, Payswiff, or QR). Please select a payment method and try again.',
  INVALID_CHANNEL: 'Invalid payment machine type selected. Please choose Pine Labs, Payswiff, or QR code.',
  SETTLEMENT_MODE_REQUIRED: 'Please choose a settlement speed (Next Day or Instant Settlement) to proceed.',
  INVALID_SETTLEMENT_MODE: 'The chosen settlement timing is not valid for this payment type. Please reselect your payment options.',
  INVALID_TRANSACTION_AMOUNT: 'Payment amount must be greater than zero. Please enter a valid amount.',
  DUPLICATE_SWIPE: 'A payment with this exact slip number and amount was already recorded today. Please verify the slip number before trying again.',
  MERCHANT_ID_REQUIRED: 'Merchant shop ID is required. Please check your account or log in again.',
  TRANSACTION_NOT_FOUND: 'The payment record could not be found. Please check your transaction history or refresh the page.',
  TRANSACTION_ALREADY_REVERSED: 'This payment has already been cancelled and refunded. No further action can be taken.',

  // Rates & Hierarchy
  PARENT_CHANNEL_MISSING: 'This payment method is not enabled for your distributor. Please contact your distributor or support to activate it.',
  RATE_NOT_CONFIGURED: 'Transaction fee is not configured for your account. Please contact your distributor or support to set up your rates.',
  INVALID_RATE_HIERARCHY: "Your commission rate cannot be lower than your distributor's rate. Please ask your distributor or admin to update the rate.",
  INVALID_RATE_VALUE: 'Fee rate must be a positive percentage up to 100%. Please enter a valid rate.',
  RATE_ERROR: 'There was an issue loading your fee rates. Please contact support or try again.',

  // Wallets, Withdrawals & Payouts
  WALLET_NOT_FOUND: 'Your shop wallet could not be found. Please contact support to activate your wallet.',
  INSUFFICIENT_CHANNEL_BALANCE: 'You do not have enough withdrawable balance in this wallet after keeping the ₹500 required reserve. Please enter a lower withdrawal amount.',
  INVALID_WITHDRAWAL_AMOUNT: 'Withdrawal amount must be greater than zero. Please enter the amount you want to transfer to your bank.',
  BENEFICIARY_REQUIRED: 'Please select an approved bank account to receive your payout.',
  UNVERIFIED_BENEFICIARY: 'This bank account has not been verified yet. Please wait for verification or choose another verified account.',
  INVALID_BENEFICIARY: 'The selected bank account is invalid or does not belong to your shop. Please select a registered account.',
  INVALID_BENEFICIARY_DETAILS: 'The bank account number or IFSC code is missing or incorrect. Please edit your bank details and try again.',
  MISSING_BANK_DETAILS: 'Bank account number or IFSC code is missing. Please update your bank account details before requesting payout.',
  UTR_REQUIRED: 'Bank UTR or transfer reference number is required to complete this payout. Please enter the reference number from the bank.',
  INVALID_UTR_FORMAT: 'Bank UTR reference number must be between 6 and 50 letters and numbers. Please check your bank receipt.',
  DUPLICATE_UTR: 'This bank reference number was already used for another payout. Please check your bank slip and enter the correct reference number.',
  ALREADY_EXPORTED: 'These withdrawal requests have already been processed. Please refresh the page to view current pending payouts.',
  NO_PENDING_WITHDRAWALS: 'There are no pending withdrawal requests to process right now.',
  CANNOT_MODIFY_COMPLETED: 'This withdrawal has already been completed and sent to the bank. It cannot be edited or changed.',
  CANNOT_MODIFY_REJECTED: 'This withdrawal was already rejected and refunded to the wallet. It cannot be modified.',

  // Ledger & System Invariants
  INVALID_LEDGER_TYPE: 'Invalid transaction type encountered. Please contact support.',
  NO_LEDGER_ENTRIES: 'No accounting entries were found for this transaction. Please contact support.',
  MATHEMATICAL_INVARIANT_VIOLATION: 'Payment amounts could not be balanced correctly. The transaction was stopped for safety. Please try again.',
  DATABASE_CLIENT_REQUIRED: 'Database connection is busy or unavailable. Please wait a moment and try again.',
  INVALID_ARGUMENT: 'Some required information is missing or entered incorrectly. Please check your input and try again.',
  SETTING_NOT_FOUND: 'A required system setting is missing. Please contact support.',
  SECURITY_CONFIG_ERROR: 'Server security settings are incomplete. Please contact support.',
  SIMULATED_FAILURE: 'Test failure was triggered. Please try again.'
};

/**
 * Text phrase patterns for errors returned as messages without explicit codes
 */
const PHRASE_MATCHERS = [
  {
    pattern: /reserve|at most rs/i,
    code: 'INSUFFICIENT_CHANNEL_BALANCE',
    message: 'You do not have enough withdrawable balance in this wallet after keeping the ₹500 required reserve. Please enter a lower withdrawal amount.'
  },
  {
    pattern: /rate.*lower than.*parent|lower rate than upline|rate hierarchy/i,
    code: 'INVALID_RATE_HIERARCHY',
    message: "Your commission rate cannot be lower than your distributor's rate. Please ask your distributor or admin to update the rate."
  },
  {
    pattern: /parent.*not have channel|parent_channel_missing/i,
    code: 'PARENT_CHANNEL_MISSING',
    message: 'This payment method is not enabled for your distributor. Please contact your distributor or support to activate it.'
  },
  {
    pattern: /admin.*cannot.*swipe/i,
    code: 'ADMIN_CANNOT_SWIPE',
    message: 'Administrator accounts cannot record card swipes. Please log in with your merchant account to accept customer payments.'
  },
  {
    pattern: /duplicate.*utr|completed withdrawal with utr/i,
    code: 'DUPLICATE_UTR',
    message: 'This bank reference number was already used for another payout. Please check your bank slip and enter the correct reference number.'
  },
  {
    pattern: /duplicate.*swipe|slip.*already recorded/i,
    code: 'DUPLICATE_SWIPE',
    message: 'A payment with this exact slip number and amount was already recorded today. Please verify the slip number before trying again.'
  },
  {
    pattern: /missing account number or ifsc|invalid_beneficiary_details|missing_bank_details/i,
    code: 'INVALID_BENEFICIARY_DETAILS',
    message: 'The bank account number or IFSC code is missing or incorrect. Please edit your bank details and try again.'
  },
  {
    pattern: /token.*expired|session ended|session.*expired/i,
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'Your login session has expired. Please log in again to continue.'
  },
  {
    pattern: /access denied|access forbidden|forbidden_admin_only|not authorized|not allowed/i,
    code: 'ACCESS_DENIED',
    message: 'You do not have permission to access this feature. Please contact support if you need access.'
  },
  {
    pattern: /mobile number login is disabled/i,
    code: 'ACCESS_DENIED',
    message: 'Mobile number login is disabled. Please enter your User ID (e.g. ADM001, MST, SD, DIST, MID).'
  },
  {
    pattern: /incorrect password|password does not match/i,
    code: 'AUTH_TOKEN_INVALID',
    message: 'Incorrect password. Please verify your password and credentials.'
  },
  {
    pattern: /new password must be at least/i,
    code: 'INVALID_ARGUMENT',
    message: 'Your new password must be at least 6 characters long.'
  },
  {
    pattern: /cannot approve a reversed or rejected/i,
    code: 'CANNOT_MODIFY_REJECTED',
    message: 'This payment was already reversed or rejected and cannot be approved.'
  },
  {
    pattern: /cannot suspend super admin|cannot delete super admin/i,
    code: 'ACCESS_DENIED',
    message: 'The master administrator account cannot be suspended or deleted.'
  },
  {
    pattern: /generic database endpoints/i,
    code: 'ACCESS_DENIED',
    message: 'Direct database access is not permitted. Please use the application screens.'
  }
];

/**
 * Universal extractor and translator:
 * Converts any server error, response object, or code into a shopkeeper-friendly message.
 * Logs the raw code / technical details exclusively in the console.
 */
export function getPlainErrorMessage(errorInput) {
  if (!errorInput) return DEFAULT_UNKNOWN_ERROR_MESSAGE;

  let rawCode = null;
  let rawMsg = null;

  if (typeof errorInput === 'string') {
    rawMsg = errorInput.trim();
    if (errorInput.includes(':')) {
      const candidate = errorInput.split(':')[0].trim().toUpperCase();
      if (ERROR_CODE_MAP[candidate]) {
        rawCode = candidate;
      }
    } else {
      const candidate = errorInput.trim().toUpperCase();
      if (ERROR_CODE_MAP[candidate]) {
        rawCode = candidate;
      }
    }
  } else if (typeof errorInput === 'object') {
    rawCode = errorInput.code || errorInput.error || errorInput.rawError || null;
    rawMsg = errorInput.message || errorInput.rawMessage || null;

    if (!rawCode && typeof rawMsg === 'string' && rawMsg.includes(':')) {
      const candidate = rawMsg.split(':')[0].trim().toUpperCase();
      if (ERROR_CODE_MAP[candidate]) {
        rawCode = candidate;
      }
    }
  }

  // Raw codes/messages logged only in the console
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[RONAV Server Error Code]:', rawCode || 'UNKNOWN', '| Technical message:', rawMsg);
  }

  // 1. Direct match by code
  if (rawCode && ERROR_CODE_MAP[rawCode]) {
    return ERROR_CODE_MAP[rawCode];
  }

  // 2. Phrase matching against raw message
  if (rawMsg) {
    for (const matcher of PHRASE_MATCHERS) {
      if (matcher.pattern.test(rawMsg)) {
        return matcher.message;
      }
    }
  }

  // 3. Fallback for unrecognized or unknown errors
  return DEFAULT_UNKNOWN_ERROR_MESSAGE;
}
