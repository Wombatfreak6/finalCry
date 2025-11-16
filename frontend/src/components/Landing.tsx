import { useEffect, useRef, useState } from "react"
import { Room } from "./Room";

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || `http://${window.location.hostname}:3000`;

export const Landing = () => {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [step, setStep] = useState<'email' | 'name'>('email');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setlocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [joined, setJoined] = useState(false);

    const getCam = async () => {
        try {
            const stream = await window.navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })
            // MediaStream
            const audioTrack = stream.getAudioTracks()[0]
            const videoTrack = stream.getVideoTracks()[0]
            setLocalAudioTrack(audioTrack);
            setlocalVideoTrack(videoTrack);
            if (videoRef.current) {
                // Stop any existing playback to prevent interruption
                if (videoRef.current.srcObject) {
                    const oldStream = videoRef.current.srcObject as MediaStream;
                    oldStream.getTracks().forEach(track => track.stop());
                }
                videoRef.current.srcObject = new MediaStream([videoTrack])
                videoRef.current.play().catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error("Error playing video:", err);
                    }
                });
            }
        } catch (error) {
            console.error("Error accessing camera/microphone:", error);
            alert("Could not access camera/microphone. Please allow permissions and refresh the page.");
        }
    }

    useEffect(() => {
        getCam();
    }, []);

    useEffect(() => {
        if (!videoRef.current || !localVideoTrack) {
            return;
        }

        const currentStream = videoRef.current.srcObject as MediaStream | null;
        const currentTrack = currentStream?.getVideoTracks()[0];

        // Only stop the preview track if it's different from the incoming track.
        if (currentTrack && currentTrack !== localVideoTrack) {
            currentTrack.stop();
        }

        if (currentTrack !== localVideoTrack) {
            videoRef.current.srcObject = new MediaStream([localVideoTrack]);
        }

        videoRef.current
            .play()
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Error playing video:", err);
                }
            });
    }, [localVideoTrack, videoRef]);

    const verifyEmail = async () => {
        if (!email.trim()) {
            setError('Please enter your college email');
            return;
        }

        setLoading(true);
        setError("");

        console.log('Backend URL:', BACKEND_URL);
        console.log('Attempting to verify email:', email.trim());

        try {
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${BACKEND_URL}/api/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email: email.trim(),
                    name: name.trim() || 'User'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Invalid response' }));
                setError(errorData.error || 'Invalid email address');
                setLoading(false);
                return;
            }

            const data = await response.json();

            setVerifiedEmail(email.trim());
            if (data.user && data.user.name) {
                setName(data.user.name);
            }
            setStep('name');
            setLoading(false);
        } catch (error: any) {
            console.error('Error verifying email:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            if (error.name === 'AbortError') {
                setError('Request timed out. Please check your connection and try again.');
            } else {
                setError('Failed to verify email. Please try again.');
            }
            setLoading(false);
        }
    };

    const handleStartChatting = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!verifiedEmail) {
            setError('Please verify your email first');
            return;
        }
        setJoined(true);
    };

    if (!joined) {
        return (
            <div className="landing-screen">
                <div className="background-glow" />
                <div className="landing-card">
                    <div className="landing-header">
                        <p className="tagline">campus-only vibes</p>
                        <h1>College Omegle</h1>
                        <p className="subhead">Meet students in seconds. Safe, real, instantly matched.</p>
                    </div>

                    <div className="preview-panel">
                        <span className="preview-label">Live preview</span>
                        <div className="neon-outline preview-video">
                            <video 
                                autoPlay 
                                ref={videoRef}
                                className="video-frame"
                                muted
                            ></video>
                        </div>
                    </div>

                    {error && (
                        <div className="alert">
                            {error}
                        </div>
                    )}

                    {step === 'email' && (
                        <div className="form-section">
                            <label className="field-label">
                                Enter your college email
                            </label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@university.edu"
                                className="input-field"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && email.trim()) {
                                        verifyEmail();
                                    }
                                }}
                            />
                            <p className="helper-text">
                                Only .edu, .edu.in, .ac.uk, .ac.in domains are accepted.
                                For testing, you can use test@test.test
                            </p>
                            <button 
                                onClick={verifyEmail}
                                disabled={!email.trim() || loading}
                                className="btn primary"
                            >
                                {loading ? 'Verifying...' : 'Continue'}
                            </button>
                        </div>
                    )}

                    {step === 'name' && (
                        <div className="form-section">
                            <p style={{ color: '#4ade80', fontWeight: 600 }}>
                                ✓ Email verified: {verifiedEmail}
                            </p>
                            <label className="field-label">
                                Enter your name
                            </label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="input-field"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && name.trim()) {
                                        handleStartChatting();
                                    }
                                }}
                            />
                            <div className="actions-row">
                                <button 
                                    onClick={() => {
                                        setStep('email');
                                        setError('');
                                    }}
                                    className="btn secondary"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={handleStartChatting}
                                    disabled={!name.trim()}
                                    className="btn primary"
                                >
                                    Start Chatting
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return <Room name={name} email={verifiedEmail || ''} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />
}