import { Filter } from "bad-words";
import { differenceInYears } from "date-fns";
import { isValidPhoneNumber } from "libphonenumber-js";

const filter = new Filter();

export const isPhoneNumberValid = (phone: string): boolean => {
  return isValidPhoneNumber(phone, { defaultCountry: "US" });
};

export const isNameValid = (name: string): boolean => {
  return (
    /^(?=.*\p{L})[\p{L}\p{M}’'\- ]+$/u.test(name.trim()) &&
    name.length >= 1 &&
    name.length <= 50 &&
    !filter.isProfane(name.toLowerCase())
  );
};

export const isValidDate = (date: string): boolean => {
  const age = differenceInYears(new Date(), new Date(date));
  return age >= 13 && age <= 100;
};
