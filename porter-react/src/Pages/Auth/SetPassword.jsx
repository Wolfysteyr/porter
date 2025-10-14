import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../../Context/AppContext';


export default function SetPassword() {
    const { appAddress } = useContext(AppContext);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors({});
        setMessage('');
        
        if (password !== passwordConfirmation) {
            setErrors({ password_confirmation: ["Passwords do not match."] });
            setLoading(false);
            return;
        }
        // basic guard: email and token must be present
        if (!email || !token) {
            setErrors({ general: ['Missing reset token or email in the link.'] });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${appAddress}/api/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    token,
                    password,
                    password_confirmation: passwordConfirmation,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || 'Password has been reset successfully. You can now log in with your new password.');
            } else {
                // surface validation errors if present
                if (data?.errors) setErrors(data.errors);
                setMessage(data?.message || 'Failed to reset password.');
                setLoading(false);
                return;
            }
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            setMessage('An error occurred. Please try again later.');
            console.error('Error resetting password:', error);
        } finally {
            setLoading(false);
        }
    }
    return (
        <div className="auth-container">
            <h2>Set New Password</h2>
            {message && <p className="message">{message}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="password">New Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password_confirmation">Confirm New Password</label>
                    <input
                        type="password"
                        id="password_confirmation"
                        value={passwordConfirmation}
                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                        required
                    />
                </div>
                {errors.password_confirmation && (
                    <p className="error">{errors.password_confirmation[0]}</p>
                )}
                <button type="submit" disabled={loading}>
                    {loading ? 'Setting...' : 'Set New Password'}
                </button>
            </form>
        </div>
    );
}