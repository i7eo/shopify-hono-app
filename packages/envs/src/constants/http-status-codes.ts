// see https://github.com/w3cj/stoker/blob/main/scripts/update-http-statuses.ts
// https://raw.githubusercontent.com/prettymuchbryce/http-status-codes/refs/heads/master/codes.json
export const HTTP_STATUS_CODES = {
  ACCEPTED: {
    code: 202,
    phrase: "Accepted",
  },
  BAD_GATEWAY: {
    code: 502,
    phrase: "Bad Gateway",
  },
  BAD_REQUEST: {
    code: 400,
    phrase: "Bad Request",
  },
  CONFLICT: {
    code: 409,
    phrase: "Conflict",
  },
  CONTINUE: {
    code: 100,
    phrase: "Continue",
  },
  CREATED: {
    code: 201,
    phrase: "Created",
  },
  EXPECTATION_FAILED: {
    code: 417,
    phrase: "Expectation Failed",
  },
  FAILED_DEPENDENCY: {
    code: 424,
    phrase: "Failed Dependency",
  },
  FORBIDDEN: {
    code: 403,
    phrase: "Forbidden",
  },
  GATEWAY_TIMEOUT: {
    code: 504,
    phrase: "Gateway Timeout",
  },
  GONE: {
    code: 410,
    phrase: "Gone",
  },
  HTTP_VERSION_NOT_SUPPORTED: {
    code: 505,
    phrase: "HTTP Version Not Supported",
  },
  IM_A_TEAPOT: {
    code: 418,
    phrase: "I'm a teapot",
  },
  INSUFFICIENT_SPACE_ON_RESOURCE: {
    code: 419,
    phrase: "Insufficient Space on Resource",
  },
  INSUFFICIENT_STORAGE: {
    code: 507,
    phrase: "Insufficient Storage",
  },
  INTERNAL_SERVER_ERROR: {
    code: 500,
    phrase: "Internal Server Error",
  },
  LENGTH_REQUIRED: {
    code: 411,
    phrase: "Length Required",
  },
  LOCKED: {
    code: 423,
    phrase: "Locked",
  },
  METHOD_FAILURE: {
    code: 420,
    phrase: "Method Failure",
  },
  METHOD_NOT_ALLOWED: {
    code: 405,
    phrase: "Method Not Allowed",
  },
  MOVED_PERMANENTLY: {
    code: 301,
    phrase: "Moved Permanently",
  },
  MOVED_TEMPORARILY: {
    code: 302,
    phrase: "Moved Temporarily",
  },
  MULTI_STATUS: {
    code: 207,
    phrase: "Multi-Status",
  },
  MULTIPLE_CHOICES: {
    code: 300,
    phrase: "Multiple Choices",
  },
  NETWORK_AUTHENTICATION_REQUIRED: {
    code: 511,
    phrase: "Network Authentication Required",
  },
  NO_CONTENT: {
    code: 204,
    phrase: "No Content",
  },
  NON_AUTHORITATIVE_INFORMATION: {
    code: 203,
    phrase: "Non Authoritative Information",
  },
  NOT_ACCEPTABLE: {
    code: 406,
    phrase: "Not Acceptable",
  },
  NOT_FOUND: {
    code: 404,
    phrase: "Not Found",
  },
  NOT_IMPLEMENTED: {
    code: 501,
    phrase: "Not Implemented",
  },
  NOT_MODIFIED: {
    code: 304,
    phrase: "Not Modified",
  },
  OK: {
    code: 200,
    phrase: "OK",
  },
  PARTIAL_CONTENT: {
    code: 206,
    phrase: "Partial Content",
  },
  PAYMENT_REQUIRED: {
    code: 402,
    phrase: "Payment Required",
  },
  PERMANENT_REDIRECT: {
    code: 308,
    phrase: "Permanent Redirect",
  },
  PRECONDITION_FAILED: {
    code: 412,
    phrase: "Precondition Failed",
  },
  PRECONDITION_REQUIRED: {
    code: 428,
    phrase: "Precondition Required",
  },
  PROCESSING: {
    code: 102,
    phrase: "Processing",
  },
  EARLY_HINTS: {
    code: 103,
    phrase: "Early Hints",
  },
  UPGRADE_REQUIRED: {
    code: 426,
    phrase: "Upgrade Required",
  },
  PROXY_AUTHENTICATION_REQUIRED: {
    code: 407,
    phrase: "Proxy Authentication Required",
  },
  REQUEST_HEADER_FIELDS_TOO_LARGE: {
    code: 431,
    phrase: "Request Header Fields Too Large",
  },
  REQUEST_TIMEOUT: {
    code: 408,
    phrase: "Request Timeout",
  },
  REQUEST_TOO_LONG: {
    code: 413,
    phrase: "Request Entity Too Large",
  },
  REQUEST_URI_TOO_LONG: {
    code: 414,
    phrase: "Request-URI Too Long",
  },
  REQUESTED_RANGE_NOT_SATISFIABLE: {
    code: 416,
    phrase: "Requested Range Not Satisfiable",
  },
  RESET_CONTENT: {
    code: 205,
    phrase: "Reset Content",
  },
  SEE_OTHER: {
    code: 303,
    phrase: "See Other",
  },
  SERVICE_UNAVAILABLE: {
    code: 503,
    phrase: "Service Unavailable",
  },
  SWITCHING_PROTOCOLS: {
    code: 101,
    phrase: "Switching Protocols",
  },
  TEMPORARY_REDIRECT: {
    code: 307,
    phrase: "Temporary Redirect",
  },
  TOO_MANY_REQUESTS: {
    code: 429,
    phrase: "Too Many Requests",
  },
  UNAUTHORIZED: {
    code: 401,
    phrase: "Unauthorized",
  },
  UNAVAILABLE_FOR_LEGAL_REASONS: {
    code: 451,
    phrase: "Unavailable For Legal Reasons",
  },
  UNPROCESSABLE_ENTITY: {
    code: 422,
    phrase: "Unprocessable Entity",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    code: 415,
    phrase: "Unsupported Media Type",
  },
  USE_PROXY: {
    code: 305,
    phrase: "Use Proxy",
  },
  MISDIRECTED_REQUEST: {
    code: 421,
    phrase: "Misdirected Request",
  },
} as const;
