// client/src/hooks/useLongPress.js
// Returns touch/mouse handlers for long-press detection

import { useRef, useCallback } from 'react';

export default function useLongPress(callback, duration = 500) {
    const timerRef = useRef(null);
    const movedRef = useRef(false);

    const start = useCallback((e) => {
        movedRef.current = false;
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) {
                callback(e);
            }
        }, duration);
    }, [callback, duration]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onMove = useCallback(() => {
        movedRef.current = true;
        cancel();
    }, [cancel]);

    return {
        onTouchStart: start,
        onTouchEnd: cancel,
        onTouchMove: onMove,
        onMouseDown: start,
        onMouseUp: cancel,
        onMouseLeave: cancel,
    };
}
