import { isValidPhoneNumber } from 'libphonenumber-js';
import { Filter } from 'bad-words';

const filter = new Filter();

export const isPhoneNumberValid = (phone: string): boolean => {
    return isValidPhoneNumber(phone, { defaultCountry: 'US' });
}

export const isNameValid = (name: string): boolean => {
    return (
        /^(?=.*\p{L})[\p{L}\p{M}’'\- ]+$/u.test(name.trim()) &&
        name.length >= 1 &&
        name.length <= 50 &&
        !filter.isProfane(name.toLowerCase())
      );
}
