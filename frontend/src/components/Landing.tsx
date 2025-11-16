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
        return <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: '#f5f5f5'
        }}>
            <h1 style={{ marginBottom: '30px', color: '#333' }}>College Omegle</h1>
            <div style={{ 
                backgroundColor: 'white', 
                padding: '30px', 
                borderRadius: '10px', 
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                maxWidth: '500px',
                width: '100%'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <video 
                        autoPlay 
                        ref={videoRef}
                        style={{ 
                            width: '100%', 
                            maxWidth: '400px', 
                            height: '300px', 
                            borderRadius: '8px',
                            backgroundColor: '#000',
                            border: '2px solid #333'
                        }}
                        muted
                    ></video>
                </div>

                {error && (
                    <div style={{
                        padding: '10px',
                        marginBottom: '20px',
                        backgroundColor: '#ffebee',
                        color: '#c62828',
                        borderRadius: '5px',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                {step === 'email' && (
                    <>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                                Enter your college email:
                            </label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@university.edu"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '16px',
                                    border: '2px solid #ddd',
                                    borderRadius: '5px',
                                    boxSizing: 'border-box'
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && email.trim()) {
                                        verifyEmail();
                                    }
                                }}
                            />
                            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                Only .edu, .edu.in, .ac.uk, .ac.in, and other college domains are accepted. 
                                For testing, you can use test@test.test
                            </p>
                        </div>
                        <button 
                            onClick={verifyEmail}
                            disabled={!email.trim() || loading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '16px',
                                backgroundColor: email.trim() && !loading ? '#4CAF50' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: email.trim() && !loading ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold'
                            }}
                        >
                            {loading ? 'Verifying...' : 'Continue'}
                        </button>
                    </>
                )}

                {step === 'name' && (
                    <>
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ marginBottom: '10px', color: '#4CAF50', fontWeight: 'bold' }}>
                                ✓ Email verified: {verifiedEmail}
                            </p>
                            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                                Enter your name:
                            </label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '16px',
                                    border: '2px solid #ddd',
                                    borderRadius: '5px',
                                    boxSizing: 'border-box'
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && name.trim()) {
                                        handleStartChatting();
                                    }
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => {
                                    setStep('email');
                                    setError('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    fontSize: '16px',
                                    backgroundColor: '#f5f5f5',
                                    color: '#333',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleStartChatting}
                                disabled={!name.trim()}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    fontSize: '16px',
                                    backgroundColor: name.trim() ? '#4CAF50' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: name.trim() ? 'pointer' : 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                            >
                                Start Chatting
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    }

    return <Room name={name} email={verifiedEmail || ''} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />
}