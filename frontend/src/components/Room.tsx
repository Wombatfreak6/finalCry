import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";

// Use backend URL from env if provided, otherwise use the current page host.
// This allows opening the app from another device on the same network without code changes.
const BACKEND_HOST = (import.meta as any).env?.VITE_BACKEND_URL || window.location.hostname;
const URL = BACKEND_HOST.startsWith('http') ? BACKEND_HOST : `http://${BACKEND_HOST}:3000`;

export const Room = ({
    name,
    email,
    localAudioTrack,
    localVideoTrack
}: {
    name: string,
    email: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

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

        socket.on("answer", ({roomId, sdp: remoteSdp}) => {
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

    const handleDisconnect = () => {
        if (socket && currentRoomId) {
            socket.emit('disconnect-room');
            setLobby(true);
            setCurrentRoomId(null);
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

    const handleReport = () => {
        if (socket && currentRoomId) {
            if (confirm('Are you sure you want to report this user?')) {
                socket.emit('report-user', { roomId: currentRoomId });
                handleDisconnect();
            }
        }
    };

    const videoStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '420px',
        aspectRatio: '4 / 3',
        border: '2px solid #333',
        borderRadius: '12px',
        backgroundColor: '#000',
        objectFit: 'cover',
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
    };

    return <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Hi {name}!</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div>
                <h3>You</h3>
                <video 
                    autoPlay 
                    playsInline
                    ref={localVideoRef}
                    style={videoStyle}
                    muted
                />
            </div>
            <div>
                <h3>{lobby ? 'Waiting for match...' : 'Connected'}</h3>
                <video 
                    autoPlay 
                    playsInline
                    ref={remoteVideoRef}
                    style={videoStyle}
                />
            </div>
        </div>
        {!lobby && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                    onClick={handleDisconnect}
                    style={{ 
                        padding: '10px 20px', 
                        fontSize: '16px', 
                        backgroundColor: '#ff4444', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    Disconnect
                </button>
                <button 
                    onClick={handleReport}
                    style={{ 
                        padding: '10px 20px', 
                        fontSize: '16px', 
                        backgroundColor: '#ff8800', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    Report
                </button>
            </div>
        )}
    </div>
}

