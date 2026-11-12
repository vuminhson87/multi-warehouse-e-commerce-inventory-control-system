import { describe, expect, it } from 'vitest'
import { prepareRegistration } from '../../../src/utils/registrationForm.js'

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
})
