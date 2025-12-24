import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
  onTwoThumbsUp?: () => void;
  onOneThumbUp?: () => void;
  onClosedFist?: () => void;
}

// --- HELPER FUNCTIONS ---

const getDist = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
};

// Logic Thumb Up (giữ nguyên độ chính xác để mở thư)
const isThumbUpGesture = (landmarks: any[]) => {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbBase = landmarks[2];

  // 1. Ngón cái duỗi
  const isThumbExtended = getDist(thumbTip, wrist) > getDist(thumbBase, wrist) * 1.2;

  // 2. Các ngón khác gập
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18]; 
  
  let foldedCount = 0;
  for (let i = 0; i < 4; i++) {
    if (getDist(landmarks[tips[i]], wrist) < getDist(landmarks[pips[i]], wrist) * 1.1) { 
        foldedCount++;
    }
  }

  // Yêu cầu chặt chẽ: Ngón cái duỗi VÀ 4 ngón kia gập
  return isThumbExtended && foldedCount >= 4; 
};

// Logic đếm số ngón tay đang duỗi (Logic cũ - Đơn giản & Hiệu quả)
const countExtendedFingers = (landmarks: any[]) => {
    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20]; // Đầu ngón: Trỏ, Giữa, Nhẫn, Út
    const bases = [5, 9, 13, 17]; // Khớp nối bàn tay
    
    let count = 0;
    
    // Check 4 ngón chính
    for (let i = 0; i < 4; i++) {
        // Nếu đầu ngón xa cổ tay hơn khớp nối đáng kể -> Duỗi
        if (getDist(landmarks[tips[i]], wrist) > getDist(landmarks[bases[i]], wrist) * 1.2) {
            count++;
        }
    }
    
    // Check ngón cái (đơn giản hơn logic ThumbUp)
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    if (getDist(thumbTip, wrist) > getDist(thumbBase, wrist) * 1.2) {
        count++;
    }
    
    return count;
};


export const GestureController: React.FC<GestureControllerProps> = ({ 
    onModeChange, 
    currentMode, 
    onHandPosition, 
    onTwoHandsDetected, 
    onTwoThumbsUp,
    onOneThumbUp,
    onClosedFist
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Initializing...");
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  const lastModeRef = useRef<TreeMode>(currentMode);
  
  // Counters check
  const twoThumbFrames = useRef(0);
  const oneThumbFrames = useRef(0);
  const closedFrames = useRef(0);
  const openFrames = useRef(0);
  
  const THRESHOLD = 8; 

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setDebugStatus("Error Loading Model");
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setDebugStatus("Waiting for hands...");
          }
        } catch (err) {
            setDebugStatus("Camera Denied");
        }
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;
      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (result.landmarks) {
            drawAllHands(result.landmarks);
            handleGestures(result.landmarks);
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const handleGestures = (landmarks: any[][]) => {
        const count = landmarks.length;
        onTwoHandsDetected?.(count === 2);

        // --- CẬP NHẬT VỊ TRÍ TAY ---
        if (count > 0) {
            const hand = landmarks[0];
            const palmX = (hand[0].x + hand[9].x) / 2;
            const palmY = (hand[0].y + hand[9].y) / 2;
            setHandPos({ x: palmX, y: palmY });
            onHandPosition?.(palmX, palmY, true);
        } else {
            onHandPosition?.(0.5, 0.5, false);
        }

        // --- GESTURE LOGIC ---

        // 1. Ưu tiên cao nhất: 2 THUMB UP (MỞ QUÀ)
        if (count === 2) {
            if (isThumbUpGesture(landmarks[0]) && isThumbUpGesture(landmarks[1])) {
                twoThumbFrames.current++;
                if (twoThumbFrames.current > THRESHOLD) {
                    setDebugStatus("🎁 2 Thumbs: OPEN GIFT");
                    onTwoThumbsUp?.();
                    oneThumbFrames.current = 0;
                    return; 
                }
            } else {
                twoThumbFrames.current = 0;
            }
        } else {
            twoThumbFrames.current = 0;
        }

        // 2. Logic cho 1 tay
        // Tìm xem có cử chỉ nào xuất hiện không
        let detectedOneThumbUp = false;
        let extendedFingers = 0;

        // Lấy thông số từ tay đầu tiên (hoặc duyệt tất cả để tìm ThumbUp)
        for (const hand of landmarks) {
            if (isThumbUpGesture(hand)) {
                detectedOneThumbUp = true;
                break; // Ưu tiên tìm thumb up trước
            }
            // Nếu không phải ThumbUp, đếm số ngón tay của tay đầu tiên để điều khiển cây
            if (hand === landmarks[0]) {
                extendedFingers = countExtendedFingers(hand);
            }
        }

        if (detectedOneThumbUp) {
            // --- TRƯỜNG HỢP: 1 THUMB UP (MỞ THƯ) ---
            oneThumbFrames.current++;
            closedFrames.current = 0;
            openFrames.current = 0;

            if (oneThumbFrames.current > THRESHOLD) {
                setDebugStatus("👍 1 Thumb: READ LETTER");
                onOneThumbUp?.();
            }
        } else {
            oneThumbFrames.current = 0;

            // --- TRƯỜNG HỢP: NẮM ĐẤM / THU CÂY (Dựa vào số ngón tay <= 1) ---
            // Đây là logic cũ: chỉ cần ít hơn hoặc bằng 1 ngón mở là tính nắm đấm
            if (extendedFingers <= 1) {
                closedFrames.current++;
                openFrames.current = 0;

                if (closedFrames.current > THRESHOLD) {
                    setDebugStatus(`✊ Fist (${extendedFingers}): FORM TREE`);
                    onClosedFist?.();
                    
                    if (lastModeRef.current !== TreeMode.FORMED) {
                        lastModeRef.current = TreeMode.FORMED;
                        onModeChange(TreeMode.FORMED);
                    }
                }
            }
            // --- TRƯỜNG HỢP: MỞ TAY / BUNG CÂY (>= 4 ngón) ---
            else if (extendedFingers >= 4) {
                openFrames.current++;
                closedFrames.current = 0;

                if (openFrames.current > THRESHOLD) {
                    setDebugStatus(`🖐 Open (${extendedFingers}): CHAOS`);
                    
                    if (lastModeRef.current !== TreeMode.CHAOS) {
                        lastModeRef.current = TreeMode.CHAOS;
                        onModeChange(TreeMode.CHAOS);
                    }
                }
            } else {
                // Trạng thái trung gian (2-3 ngón)
                closedFrames.current = 0;
                openFrames.current = 0;
                if (twoThumbFrames.current === 0) setDebugStatus("Detected: Moving...");
            }
        }
    };

    const drawAllHands = (allLandmarks: any[][]) => {
        if (!canvasRef.current || !videoRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        ctx.clearRect(0, 0, width, height);
        allLandmarks.forEach(landmarks => drawSkeleton(ctx, landmarks, width, height));
    };

    const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number) => {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], 
            [0, 5], [5, 6], [6, 7], [7, 8], 
            [0, 9], [9, 10], [10, 11], [11, 12], 
            [0, 13], [13, 14], [14, 15], [15, 16], 
            [0, 17], [17, 18], [18, 19], [19, 20], 
            [5, 9], [9, 13], [13, 17], [0, 17] 
        ];
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#D4AF37';
        connections.forEach(([start, end]) => {
            const p1 = landmarks[start];
            const p2 = landmarks[end];
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
        });
        ctx.fillStyle = '#228B22';
        landmarks.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    };

    setupMediaPipe();
    return () => { cancelAnimationFrame(animationFrameId); if (handLandmarker) handLandmarker.close(); };
  }, []); 

  useEffect(() => { lastModeRef.current = currentMode; }, [currentMode]);

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">
      <div className="mb-2 px-3 py-1 bg-black/80 border border-[#D4AF37] rounded text-[#D4AF37] text-xs font-mono shadow-lg">
        STATUS: {debugStatus}
      </div>
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black">
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10"></div>
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20" />
        {handPos && (
          <div className="absolute w-3 h-3 bg-[#D4AF37] rounded-full border-2 border-white shadow-[0_0_10px_#D4AF37] z-30 transition-all duration-100 ease-out"
            style={{ left: `${(1 - handPos.x) * 100}%`, top: `${handPos.y * 100}%`, transform: 'translate(-50%, -50%)' }} />
        )}
      </div>
    </div>
  );
};