import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";

// Use backend URL from env if provided, otherwise use the current page host.
// This allows opening the app from another device on the same network without code changes.
const BACKEND_HOST = (import.meta as any).env?.VITE_BACKEND_URL || window.location.hostname;
const URL = BACKEND_HOST.startsWith('http') ? BACKEND_HOST : `http://${BACKEND_HOST}:3000`;

type ChatMessage = {
    id: string;
    text: string;
    sender: 'me' | 'peer';
    senderName: string;
    timestamp: string;
};

export const Room = ({
    name,
    email,
    localAudioTrack,
    localVideoTrack,
    onLeave
}: {
    name: string,
    email: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
    onLeave: () => void,
}) => {
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const chatBottomRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');

    const handleRemoteTrack = (event: RTCTrackEvent) => {
        const videoElement = remoteVideoRef.current;
        if (!videoElement) {
            return;
        }

        const incomingStream = event.streams?.[0];
        if (incomingStream && videoElement.srcObject !== incomingStream) {
            videoElement.srcObject = incomingStream;
        } else if (!incomingStream) {
            const currentStream = (videoElement.srcObject as MediaStream | null) ?? new MediaStream();
            const alreadyAdded = currentStream.getTracks().some(track => track.id === event.track.id);
            if (!alreadyAdded) {
                currentStream.addTrack(event.track);
            }
            if (videoElement.srcObject !== currentStream) {
                videoElement.srcObject = currentStream;
            }
        }

        videoElement.play().catch(err => {
            if (err.name !== "AbortError") {
                console.error("Failed to start remote video", err);
            }
        });
    };

    useEffect(() => {
        const socket = io(URL);
        
        // Send join event with email and name
        socket.emit('join', { email, name, interests: [] });
        
        socket.on('error', ({ message }: { message: string }) => {
            alert(message);
        });
        
        socket.on('user-disconnected', () => {
            setLobby(true);
            alert('The other user disconnected. Searching for a new match...');
        });

        socket.on("chat-message", ({ roomId: incomingRoomId, message, senderName, timestamp }: { roomId: string, message: string, senderName: string, timestamp: string }) => {
            setMessages(prev => ([
                ...prev,
                {
                    id: `${incomingRoomId}-${Date.now()}`,
                    text: message,
                    sender: 'peer',
                    senderName: senderName || 'Stranger',
                    timestamp: timestamp || new Date().toISOString()
                }
            ]));
        });
        
        socket.on('send-offer', async ({roomId}) => {
            console.log("sending offer");
            setLobby(false);
            setCurrentRoomId(roomId);
            const pc = new RTCPeerConnection();

            setSendingPc(pc);
            const localStream = new MediaStream();
            if (localVideoTrack) {
                localStream.addTrack(localVideoTrack);
            }
            if (localAudioTrack) {
                localStream.addTrack(localAudioTrack);
            }
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            pc.onicecandidate = async (e) => {
                console.log("receiving ice candidate locally");
                if (e.candidate) {
                   socket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "sender",
                    roomId
                   })
                }
            }

            pc.onnegotiationneeded = async () => {
                console.log("on negotiation neeeded, sending offer");
                const sdp = await pc.createOffer();
                //@ts-ignore
                pc.setLocalDescription(sdp)
                socket.emit("offer", {
                    sdp,
                    roomId
                })
            }

            pc.ontrack = handleRemoteTrack;
        });

        socket.on("offer", async ({roomId, sdp: remoteSdp}) => {
            console.log("received offer");
            setLobby(false);
            setCurrentRoomId(roomId);
            const pc = new RTCPeerConnection();
            const localStream = new MediaStream();
            if (localVideoTrack) {
                localStream.addTrack(localVideoTrack);
            }
            if (localAudioTrack) {
                localStream.addTrack(localAudioTrack);
            }
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            pc.setRemoteDescription(remoteSdp)
            const sdp = await pc.createAnswer();
            //@ts-ignore
            pc.setLocalDescription(sdp)

            setReceivingPc(pc);
            pc.ontrack = handleRemoteTrack;

            pc.onicecandidate = async (e) => {
                if (!e.candidate) {
                    return;
                }
                console.log("omn ice candidate on receiving seide");
                if (e.candidate) {
                   socket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "receiver",
                    roomId
                   })
                }
            }

            socket.emit("answer", {
                roomId,
                sdp: sdp
            });
        });

        socket.on("answer", ({ sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription(remoteSdp)
                return pc;
            });
            console.log("loop closed");
        })

        socket.on("lobby", () => {
            setLobby(true);
        })

        socket.on("add-ice-candidate", ({candidate, type}) => {
            console.log("add ice candidate from remote");
            console.log({candidate, type})
            if (type == "sender") {
                setReceivingPc(pc => {
                    if (!pc) {
                        console.error("receicng pc nout found")
                    }
                    pc?.addIceCandidate(candidate)
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    if (!pc) {
                        console.error("sending pc nout found")
                    }
                    pc?.addIceCandidate(candidate)
                    return pc;
                });
            }
        })

        setSocket(socket)

        return () => {
            socket.disconnect();
        }
    }, [name])

    useEffect(() => {
        if (!localVideoRef.current || !localVideoTrack) return;

        localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
        localVideoRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
                console.error("Failed to start local video preview", err);
            }
        });
    }, [localVideoTrack])

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (lobby) {
            setMessages([]);
        }
    }, [lobby]);

    const handleDisconnect = () => {
        if (socket && currentRoomId) {
            socket.emit('disconnect-room');
            setLobby(true);
            setCurrentRoomId(null);
            setMessages([]);
            setChatInput('');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            // Clean up peer connections
            if (sendingPc) {
                sendingPc.close();
                setSendingPc(null);
            }
            if (receivingPc) {
                receivingPc.close();
                setReceivingPc(null);
            }
        }
    };

    const handleCancelSearch = () => {
        if (sendingPc) {
            sendingPc.close();
            setSendingPc(null);
        }
        if (receivingPc) {
            receivingPc.close();
            setReceivingPc(null);
        }
        setMessages([]);
        setChatInput('');
        setCurrentRoomId(null);
        setLobby(true);
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
        onLeave();
    };

    const handleReport = () => {
        if (socket && currentRoomId) {
            if (confirm('Are you sure you want to report this user?')) {
                socket.emit('report-user', { roomId: currentRoomId });
                handleDisconnect();
            }
        }
    };

    const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!socket || !currentRoomId) return;
        const text = chatInput.trim();
        if (!text) return;

        const newMessage: ChatMessage = {
            id: `${currentRoomId}-${Date.now()}`,
            text,
            sender: 'me',
            senderName: name,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMessage]);
        socket.emit('chat-message', { roomId: currentRoomId, message: text });
        setChatInput('');
    };

    const roomStateClasses = lobby ? '' : 'room-connected';

    return (
        <div className={`room-container ${roomStateClasses}`}>
            <div className="background-glow" />
            <div className={`room-shell ${roomStateClasses}`}>
                <div className="room-header">
                    <div>
                        <p className="tagline">Signed in as {name}</p>
                        <h2>NST Network</h2>
                    </div>
                    <span className={`status-pill ${lobby ? 'waiting' : 'connected'}`}>
                        {'Points: 128 [to be added]'}
                    </span>
                </div>

                <div className="room-layout">
                    <div className="video-stack">
                        <div className="video-card remote-card">
                            <div className="video-meta">
                                <h3>{lobby ? 'Searching for a match…' : 'Stranger'}</h3>
                                <span>{lobby ? 'Hang tight, we are pairing you.' : 'You are connected'}</span>
                            </div>
                            <video 
                                autoPlay 
                                playsInline
                                ref={remoteVideoRef}
                                className="video-frame remote-frame"
                            />
                        </div>
                    </div>
                    <div className="chat-column">
                        <div className="chat-panel">
                            <div className="chat-header">
                                <h4>Live chat</h4>
                                
                            </div>
                            <div className="chat-messages">
                                {messages.length === 0 && (
                                    <p className="chat-empty">Keep chatting while the video stays live.</p>
                                )}
                                {messages.map(message => (
                                    <div
                                        key={message.id}
                                        className={`chat-message ${message.sender === 'me' ? 'self' : 'peer'}`}
                                    >
                                        <span className="chat-author">{message.sender === 'me' ? 'You' : message.senderName}</span>
                                        <p>{message.text}</p>
                                    </div>
                                ))}
                                <div ref={chatBottomRef} />
                            </div>
                            <form className="chat-input-row" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={lobby ? 'Chat unlocks once connected…' : 'Type a message'}
                                    className="input-field"
                                />
                                <button
                                    type="submit"
                                    className="btn primary"
                                    disabled={lobby || !chatInput.trim()}
                                >
                                    Send
                                </button>
                            </form>
                        </div>
                        <div className="controls chat-controls">
                            <button 
                                onClick={handleReport}
                                className="btn ghost"
                                disabled={lobby}
                            >
                                Report
                            </button>
                            <button 
                                onClick={lobby ? handleCancelSearch : handleDisconnect}
                                className={`btn ${lobby ? 'secondary' : 'danger'}`}
                            >
                                {lobby ? 'Cancel Search' : 'Skip'}
                            </button>
                        </div>
                        <div className="video-card self-card">
                            <div className="video-meta">
                                <h3>You</h3>
                                <span>{lobby ? 'Camera preview' : 'Live now'}</span>
                            </div>
                            <video
                                autoPlay
                                playsInline
                                ref={localVideoRef}
                                className="video-frame self-frame mirror"
                                muted
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

