
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ForgotPassword.css';
import logo from '../../assets/infinetra-logo.png';
import { FaEye, FaEyeSlash } from "react-icons/fa";

import {
  sendOtp,
  verifyOtp,
  resetPassword
} from '../../services/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState('email');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const wakeupTimerRef = useRef(null);
  const timeoutRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (wakeupTimerRef.current) clearTimeout(wakeupTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage('');
      setStatus('');
    }, 3500);

    return () => clearTimeout(timer);
  }, [message]);

  const showPopup = (text, type) => {
    setMessage(text);
    setStatus(type);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      const err = 'Please enter your registered email address.';
      setInlineError(err);
      showPopup(err, 'error');
      return;
    }

    // Clean up any existing timers & reset states
    if (wakeupTimerRef.current) clearTimeout(wakeupTimerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setInlineError('');
    setIsWakingUp(false);
    setHasFailed(false);

    const controller = new AbortController();
    timeoutRef.current = setTimeout(() => {
      controller.abort();
    }, 50000); // 50s timeout for Render free-tier cold-boot

    wakeupTimerRef.current = setTimeout(() => {
      setIsWakingUp(true);
    }, 3500); // Show helpful notice if response takes > 3.5s

    try {
      setLoading(true);

      const data = await sendOtp(email.trim(), { signal: controller.signal });

      // Immediate cleanup on success
      if (wakeupTimerRef.current) clearTimeout(wakeupTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsWakingUp(false);
      setInlineError('');

      showPopup(data.message || 'OTP sent successfully.', 'success');
      setStep('verify');

    } catch (error) {
      // Immediate cleanup on error response
      if (wakeupTimerRef.current) clearTimeout(wakeupTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsWakingUp(false);
      setHasFailed(true);

      const errorMsg = error?.message || 'Failed to send OTP.';
      setInlineError(errorMsg);
      console.error('Send OTP error:', error);
      showPopup(errorMsg, 'error');

    } finally {
      if (wakeupTimerRef.current) clearTimeout(wakeupTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsWakingUp(false);
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      showPopup('Please enter the OTP.', 'error');
      return;
    }

    try {
      setLoading(true);

      const data = await verifyOtp(
        email.trim(),
        otp.trim()
      );

      showPopup(data.message || 'OTP verified successfully.', 'success');
      setStep('reset');

    } catch (error) {
      console.error('Verify OTP error:', error);
      showPopup(error.message || 'OTP verification failed.', 'error');

    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      showPopup('Please enter and confirm your new password.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showPopup('Passwords do not match.', 'error');
      return;
    }

    try {
      setLoading(true);

      const data = await resetPassword({
        email: email.trim(),
        newPassword,
        confirmPassword
      });

      showPopup(data.message || 'Password reset successful.', 'success');
      setStep('success');

    } catch (error) {
      console.error('Reset password error:', error);
      showPopup(error.message || 'Password reset failed.', 'error');

    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-container">

      {message && (
        <div className={`top-popup ${status}`}>
          <div className="popup-icon">
            {status === 'success' ? '✓' : '×'}
          </div>

          <div className="popup-message">
            {message}
          </div>
        </div>
      )}

      <div className="login-left">
        <div className="brand-section">
          <img
            src={logo}
            alt="Infinetra Logo"
            className="logo-image"
          />

          <h1>Infinetra HRMS</h1>

          <p className="brand-description">
            Elevating enterprise productivity through intelligent employee
            management and seamless human resource workflows.
          </p>
        </div>

        <div className="feature-cards">

          <div className="feature-card">
            <svg
              className="feature-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>

            <h4>Unified Dashboard</h4>
            <p>Real-time metrics at your fingertips.</p>
          </div>

          <div className="feature-card">
            <svg
              className="feature-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L20 6V12C20 17 16.5 20 12 22C7.5 20 4 17 4 12V6L12 2Z" />
              <path d="M8.5 12L11 14.5L15.5 10" />
            </svg>

            <h4>Secure Access</h4>
            <p>Enterprise-grade data protection.</p>
          </div>

        </div>
      </div>

      <div className="login-right">
        <div className="login-form-box">

      

          {step === 'email' && (
            <>
              <h2>Forgot Password?</h2>

              <p className="subtitle">
                Enter your email, we'll send you an OTP to reset your password.
              </p>

              <form onSubmit={handleSendOTP}>
                <div className="form-group">
                  <label>Email Address</label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (inlineError) setInlineError('');
                    }}
                    placeholder="name@company.com"
                    disabled={loading}
                  />
                </div>

                {inlineError && !loading && (
                  <div className="form-error-notice">
                    <span className="error-icon">⚠️</span>
                    <span>{inlineError}</span>
                  </div>
                )}

                {isWakingUp && loading && (
                  <div className="server-wakeup-notice">
                    <span className="notice-icon">⏳</span>
                    <span>Server is starting up (cold start). Please hold on, this can take up to a minute on the first request...</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary btn-with-spinner"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-inline" />
                      <span>{isWakingUp ? 'Waking up server...' : 'Sending OTP...'}</span>
                    </>
                  ) : (
                    hasFailed ? 'Retry Send OTP' : 'Send OTP'
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'verify' && (
            <>
              <h2>Verify OTP</h2>

              <p className="subtitle">
                Enter the OTP sent to your registered email address.
              </p>

              <form onSubmit={handleVerifyOTP}>
                <div className="form-group">
                  <label>Enter OTP</label>

                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-with-spinner"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-inline" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Verify OTP'
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h2>Reset Password</h2>

              <p className="subtitle">
                Create a new password for your account.
              </p>

              <form onSubmit={handleResetPassword}>

                <div className="form-group">
                  <label>New Password</label>

                  <div className="password-wrapper">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />

                    <button
                      type="button"
                      className="eye-button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={
                        showNewPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showNewPassword ? <FaEye /> : <FaEyeSlash />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>

                  <div className="password-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />

                    <button
                      type="button"
                      className="eye-button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-with-spinner"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-inline" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>

              </form>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="success-screen">
                <div className="success-big-icon">✓</div>

                <h2>Password Reset Successful</h2>

                <p className="subtitle">
                  Your password has been updated successfully.
                </p>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}

          <div className="page-footer">
            <Link to="/login" className="link">
              Back to Login
            </Link>
          </div>

          <p className="powered-by">
            POWERED BY INFINETRA TECH
          </p>

        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
