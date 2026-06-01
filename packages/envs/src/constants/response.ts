import { HTTP_STATUS_CODES } from "./http-status-codes";

export const RESPONSE_SUCCESS_CODE = HTTP_STATUS_CODES.OK.code;

export const RESPONSE_SUCCESS_MESSAGE = HTTP_STATUS_CODES.OK.phrase;

export const RESPONSE_SUCCESS_OK = true;

/**
 * @description:  contentType
 */
export enum ContentTypeEnum {
  // json
  JSON = "application/json;charset=UTF-8",
  // form-data qs
  FORM_URLENCODED = "application/x-www-form-urlencoded;charset=UTF-8",
  // form-data  upload
  FORM_DATA = "multipart/form-data;charset=UTF-8",
}
