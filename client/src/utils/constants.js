export const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // OpenRelay (Free TURN server for testing - in production use a paid service like Twilio/Xirsys)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
};

export const EMOJI_LIST = [
    // Faces & Emotions
    '😀','😂','🤣','😍','🥰','😘','😎','🤩','😭','😢','😤','😡','🤯','😱','🥳','🤔','😏','😒','🤗','🥺',
    // Love & Hearts
    '❤️','🧡','💛','💚','💙','💜','🖤','💕','💞','💓',
    // Celebration & Objects
    '🎉','🎊','🎁','🏆','🥇','🔥','✨','💯','🎶','🎵',
    // Gestures & People
    '👍','👎','🙌','👏','🤝','🤜','💪','🙏','🫶','🤞',
    // Food & Drink
    '🍕','🍔','🍜','🍣','🍰','🍩','☕','🧋','🍺','🎂',
    // Animals
    '🐶','🐱','🐻','🦁','🐼','🦊','🦋','🐬',
    // Nature & Travel
    '🌸','🌈','⭐','🌙','☀️','🌊','🏔️','🌿',
    // Symbols & Fun
    '💫','⚡','💥','🎯','🚀','🌀',
];

