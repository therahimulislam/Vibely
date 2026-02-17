export const getDeviceId = () => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
        // Simple UUID v4 generator
        id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('deviceId', id);
    }
    return id;
};

export const getDeviceInfo = async () => {
    const info = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
    };

    // Try to use Client Hints API for better accuracy on supported browsers (Chrome/Edge)
    if (navigator.userAgentData) {
        try {
            const highEntropy = await navigator.userAgentData.getHighEntropyValues([
                'platformVersion',
                'model',
                'architecture',
                'platform',
                'uaFullVersion'
            ]);

            if (highEntropy.platformVersion) info.osVersion = highEntropy.platformVersion;
            if (highEntropy.model) info.model = highEntropy.model;
            if (highEntropy.platform) info.platformName = highEntropy.platform;
            if (highEntropy.uaFullVersion) info.browserVersion = highEntropy.uaFullVersion;
        } catch (e) {
            console.error('Error getting device info', e);
        }
    }

    return info;
};
