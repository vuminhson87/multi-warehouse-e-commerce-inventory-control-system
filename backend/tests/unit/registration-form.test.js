import { describe, expect, it } from 'vitest'
import {
    deriveUsernameFromGmail,
    formatCountdown,
    prepareOtpRegistrationRequest,
    prepareOtpVerification,
    prepareRegistration,
} from '../../../src/utils/registrationForm.js'

describe('prepareRegistration', () => {
    it('trims the account fields when confirmation matches', () => {
        expect(prepareRegistration({
            username: '  new_customer  ',
            fullName: '  New Customer  ',
            password: 'secure-pass-123',
            confirmPassword: 'secure-pass-123',
        })).toEqual({
            error: null,
            payload: {
                username: 'new_customer',
                fullName: 'New Customer',
                password: 'secure-pass-123',
            },
        })
    })

    it('returns a form error and no request payload when passwords differ', () => {
        expect(prepareRegistration({
            username: 'new_customer',
            fullName: '',
            password: 'secure-pass-123',
            confirmPassword: 'different-pass-456',
        })).toEqual({
            error: 'Mật khẩu xác nhận không khớp.',
            payload: null,
        })
    })

    it('derives default username from Gmail, supports custom overrides, and validates 6-digit OTP', () => {
        expect(deriveUsernameFromGmail('duyan746@gmail.com')).toBe('duyan746')
        expect(deriveUsernameFromGmail('Duy.An.746@gmail.com')).toBe('duy_an_746')

        expect(
            prepareOtpRegistrationRequest({
                email: '  DuyAn746@Gmail.com ',
                username: '',
                fullName: ' Duy An ',
                password: 'secure-pass-123',
                confirmPassword: 'secure-pass-123',
            })
        ).toEqual({
            error: null,
            payload: {
                email: 'duyan746@gmail.com',
                username: 'duyan746',
                fullName: 'Duy An',
                password: 'secure-pass-123',
            },
        })

        expect(prepareOtpVerification('123456')).toEqual({ error: null, otp: '123456' })
        expect(prepareOtpVerification('123').error).toBeTruthy()
        expect(formatCountdown(180)).toBe('03:00')
        expect(formatCountdown(65)).toBe('01:05')
    })
})
