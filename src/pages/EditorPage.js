import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions'; // Constants for socket event names
import Client from '../components/Client'; // Component to display connected users
import Editor from '../components/Editor'; // Code editor component
import { initSocket } from '../socket'; // Socket initialization utility
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

// EditorPage component: Manages the real-time code editor and collaboration room
const EditorPage = () => {
    // State and refs for socket, code, clients, and UI loading
    const socketRef = useRef(null); // Stores socket instance
    const codeRef = useRef(null); // Stores latest code for syncing
    const location = useLocation(); // Access location state (e.g., username)
    const { roomId } = useParams(); // Get room ID from URL
    const navigate = useNavigate(); // Programmatic navigation
    const [clients, setClients] = useState([]); // List of connected clients
    const [isLoading, setIsLoading] = useState(true); // Tracks connection status
    const [theme, setTheme] = useState('dark'); // Editor theme (dark/light)

    // Handle socket errors with consistent feedback
    const handleErrors = useCallback((err) => {
        console.error('Socket error:', err);
        toast.error('Socket connection failed. Please try again.');
        navigate('/');
    }, [navigate]);

    // Initialize socket connection and set up event listeners
    useEffect(() => {
        const init = async () => {
            try {
                // Initialize socket
                socketRef.current = await initSocket();
                setIsLoading(false); // Connection established

                // Handle connection errors
                socketRef.current.on('connect_error', handleErrors);
                socketRef.current.on('connect_failed', handleErrors);

                // Join the room with roomId and username
                socketRef.current.emit(ACTIONS.JOIN, {
                    roomId,
                    username: location.state?.username,
                });

                // Handle new user joining
                socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
                    if (username !== location.state?.username) {
                        toast.success(`${username} joined the room!`);
                        console.log(`${username} joined`);
                    }
                    setClients(clients); // Update connected clients list
                    // Sync code with the new user
                    if (codeRef.current) {
                        socketRef.current.emit(ACTIONS.SYNC_CODE, {
                            code: codeRef.current,
                            socketId,
                        });
                    }
                });

                // Handle user disconnection
                socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
                    toast.success(`${username} left the room.`);
                    setClients((prev) => prev.filter((client) => client.socketId !== socketId));
                });
            } catch (err) {
                handleErrors(err); // Handle initialization errors
            }
        };

        init();

        // Cleanup socket listeners and disconnect on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off('connect_error');
                socketRef.current.off('connect_failed');
            }
        };
    }, [handleErrors, location.state?.username, roomId]);

    // Copy room ID to clipboard with improved error handling
    const copyRoomId = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy room ID:', err);
            toast.error('Failed to copy Room ID.');
        }
    }, [roomId]);

    // Navigate back to home page when leaving the room
    const leaveRoom = useCallback(() => {
        socketRef.current?.emit(ACTIONS.DISCONNECTED, {
            roomId,
            username: location.state?.username,
        });
        navigate('/');
    }, [navigate, roomId, location.state?.username]);

    // Toggle editor theme between dark and light
    const toggleTheme = useCallback(() => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    // Redirect to home if username is missing
    if (!location.state?.username) {
        return <Navigate to="/" />;
    }

    return (
        <div className="mainWrap">
            {/* Sidebar for connected clients and controls */}
            <div className="aside">
                <div className="asideInner">
                    <div className="logo">
                        <img
                            className="logoImage"
                            src="/code-sync.png"
                            alt="CodeSync Logo"
                        />
                    </div>
                    <h3>{isLoading ? 'Connecting...' : 'Connected'}</h3>
                    <div className="clientsList">
                        {clients.map((client) => (
                            <Client
                                key={client.socketId}
                                username={client.username}
                            />
                        ))}
                    </div>
                </div>
                {/* Theme toggle button */}
                <button
                    className="btn themeBtn"
                    onClick={toggleTheme}
                >
                    {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </button>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy ROOM ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave Room
                </button>
            </div>
            {/* Editor section */}
            <div className="editorWrap">
                {isLoading ? (
                    <div className="loading">Loading editor...</div>
                ) : (
                    <Editor
                        socketRef={socketRef}
                        roomId={roomId}
                        theme={theme} // Pass theme to Editor
                        onCodeChange={(code) => {
                            codeRef.current = code; // Update code ref
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default EditorPage;