import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Check, X } from 'lucide-react';
import Cropper from 'react-easy-crop';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.setAttribute('crossOrigin', 'anonymous');
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

export default function AvatarCropModal({
    file,
    src,
    onCancel,
    onConfirm,
    title = 'Adjust photo',
    subtitle = '',
    confirmLabel = 'Done',
    outputWidth = 512,
    outputHeight = 512,
    outputMimeType = 'image/png',
    outputQuality = 0.92,
    maskShape = 'circle',
    flexible = false,
}) {
    const [crop, setCrop] = useState({ x: 0, y: 0 }); // for react-easy-crop
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // React Image Crop State
    const [freeCrop, setFreeCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const imageRef = useRef(null);

    const generatedPreviewUrl = useMemo(() => (src ? '' : URL.createObjectURL(file)), [file, src]);
    const previewUrl = src || generatedPreviewUrl;
    const aspect = outputWidth / outputHeight;

    useEffect(() => () => {
        if (generatedPreviewUrl) {
            URL.revokeObjectURL(generatedPreviewUrl);
        }
    }, [generatedPreviewUrl]);

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        if (!flexible && !croppedAreaPixels) return;
        if (flexible && (!imageRef.current || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0)) return;
        
        try {
            setIsProcessing(true);
            const image = await loadImage(previewUrl);

            let finalWidth, finalHeight, dx, dy, sWidth, sHeight;

            if (flexible) {
                const scaleX = image.naturalWidth / imageRef.current.width;
                const scaleY = image.naturalHeight / imageRef.current.height;
                
                sWidth = completedCrop.width * scaleX;
                sHeight = completedCrop.height * scaleY;
                dx = completedCrop.x * scaleX;
                dy = completedCrop.y * scaleY;
                finalWidth = sWidth;
                finalHeight = sHeight;
            } else {
                finalWidth = outputWidth;
                finalHeight = outputHeight;
                dx = croppedAreaPixels.x;
                dy = croppedAreaPixels.y;
                sWidth = croppedAreaPixels.width;
                sHeight = croppedAreaPixels.height;
            }

            const canvas = document.createElement('canvas');
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                image,
                dx,
                dy,
                sWidth,
                sHeight,
                0,
                0,
                finalWidth,
                finalHeight
            );

            canvas.toBlob((blob) => {
                setIsProcessing(false);
                if (!blob) return;
                const extension = outputMimeType === 'image/png' ? 'png' : outputMimeType === 'image/webp' ? 'webp' : 'jpg';
                const croppedFile = new File([blob], `${file.name.replace(/\\.[^.]+$/, '')}.${extension}`, { type: outputMimeType });
                onConfirm(croppedFile);
            }, outputMimeType, outputQuality);
        } catch (error) {
            console.error('Crop image error:', error);
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-50">
                <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="text-center text-white pointer-events-none">
                    <h3 className="font-medium text-[17px] tracking-wide">{title}</h3>
                </div>
                <button 
                    onClick={handleConfirm} 
                    disabled={isProcessing || (flexible && (!completedCrop || completedCrop.width === 0))}
                    className="py-1.5 px-4 -mr-2 rounded-full hover:bg-white/10 text-emerald-400 font-medium text-[16px] transition-colors disabled:opacity-50"
                >
                    {isProcessing ? 'Wait...' : confirmLabel}
                </button>
            </div>

            {/* Cropper Area */}
            <div className="flex-1 relative w-full h-full flex flex-col items-center justify-center p-[60px_20px_100px_20px]">
                {flexible ? (
                    <ReactCrop 
                        crop={freeCrop} 
                        onChange={(pixelCrop, percentCrop) => setFreeCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-full max-w-full rounded-lg"
                    >
                        <img 
                            ref={imageRef} 
                            src={previewUrl} 
                            className="max-h-full max-w-full object-contain" 
                            alt="Crop target"
                            onLoad={(e) => {
                                const { width, height } = e.currentTarget;
                                // Default crop covers central 80% initially
                                setFreeCrop({
                                    unit: '%',
                                    x: 10,
                                    y: 10,
                                    width: 80,
                                    height: 80
                                });
                                setCompletedCrop({
                                    unit: 'px',
                                    x: width * 0.1,
                                    y: height * 0.1,
                                    width: width * 0.8,
                                    height: height * 0.8
                                });
                            }}
                        />
                    </ReactCrop>
                ) : (
                    <Cropper
                        image={previewUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        cropShape={maskShape === 'circle' ? 'round' : 'rect'}
                        showGrid={true}
                        classes={{
                            containerClassName: 'w-full h-full bg-black !absolute inset-0',
                            cropAreaClassName: `border-[rgba(255,255,255,0.7)] shadow-[0_0_0_9999em_rgba(0,0,0,0.85)] ${
                                maskShape === 'rounded' ? '!rounded-[32px]' : ''
                            }`,
                        }}
                    />
                )}
            </div>

            {/* Bottom Controls (Only for easy-crop) */}
            {!flexible && (
                <div className="absolute bottom-8 left-0 right-0 px-6 z-50 flex flex-col items-center gap-4">
                    <div className="backdrop-blur-xl bg-[#1c1c1e]/80 rounded-full py-3 px-6 flex items-center gap-4 border border-white/10 w-full max-w-sm shadow-2xl">
                        <span className="text-white/40 text-xl leading-none font-light mb-1">−</span>
                        <input 
                            type="range" 
                            min={1} 
                            max={3} 
                            step={0.01} 
                            value={zoom} 
                            onChange={(e) => setZoom(Number(e.target.value))} 
                            className="w-full h-1 bg-white/20 rounded-full appearance-none outline-none accent-white cursor-pointer"
                        />
                        <span className="text-white/40 text-xl leading-none font-light mb-1">+</span>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
