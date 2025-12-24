
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode } from '../types';

/**
 * ==================================================================================
 *  INSTRUCTIONS FOR LOCAL PHOTOS
 * ==================================================================================
 * 1. Create a folder named "photos" inside your "public" directory.
 *    (e.g., public/photos/)
 * 
 * 2. Place your JPG images in there.
 * 
 * 3. Rename them sequentially:
 *    1.jpg, 2.jpg, 3.jpg ... up to 13.jpg
 * 
 *    If a file is missing (e.g., you only have 5 photos), the frame will 
 *    display a placeholder instead of crashing the app.
 * ==================================================================================
 */

const PHOTO_COUNT = 22; // How many polaroid frames to generate

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
}

const PolaroidItem: React.FC<{ data: PhotoData; mode: TreeMode; index: number }> = ({ data, mode, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  // Safe texture loading that won't crash the app if a file is missing
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      data.url,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        setTexture(loadedTex);
        setError(false);
      },
      undefined, // onProgress
      (err) => {
        console.warn(`Failed to load image: ${data.url}`, err);
        setError(true);
      }
    );
  }, [data.url]);
  
  // Random sway offset
  const swayOffset = useMemo(() => Math.random() * 100, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    
    // 1. Position Interpolation
    const targetPos = isFormed ? data.targetPos : data.chaosPos;
    const step = delta * data.speed;
    
    // Smooth lerp to target position
    groupRef.current.position.lerp(targetPos, step);

    // 2. Rotation & Sway Logic
    if (isFormed) {
        // Look at center but face outward
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        dummy.lookAt(0, groupRef.current.position.y, 0); 
        dummy.rotateY(Math.PI); // Flip to face out
        
        // Base rotation alignment
        groupRef.current.quaternion.slerp(dummy.quaternion, step);
        
        // Physical Swaying (Wind)
        // Z-axis rotation for side-to-side swing
        const swayAngle = Math.sin(time * 2.0 + swayOffset) * 0.08;
        // X-axis rotation for slight front-back tilt
        const tiltAngle = Math.cos(time * 1.5 + swayOffset) * 0.05;
        
        groupRef.current.rotateZ(swayAngle * delta * 5); // Apply over time or directly? 
        // For stable sway, we add to the base rotation calculated above.
        // But since we slerp quaternion, let's just add manual rotation after slerp?
        // Easier: Set rotation directly based on dummy + sway.
        
        // Calculate the "perfect" rotation
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.z = currentRot.z + swayAngle * 0.05; 
        groupRef.current.rotation.x = currentRot.x + tiltAngle * 0.05;
        
    } else {
        // Chaos mode - face toward camera with gentle floating
        // Camera position relative to scene group: [0, 9, 20]
        const cameraPos = new THREE.Vector3(0, 9, 20);
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        
        // Make photos face the camera
        dummy.lookAt(cameraPos);
        
        // Smoothly rotate to face camera
        groupRef.current.quaternion.slerp(dummy.quaternion, delta * 3);
        
        // Add gentle floating wobble
        const wobbleX = Math.sin(time * 1.5 + swayOffset) * 0.03;
        const wobbleZ = Math.cos(time * 1.2 + swayOffset) * 0.03;
        
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.x = currentRot.x + wobbleX;
        groupRef.current.rotation.z = currentRot.z + wobbleZ;
    }
  });

  return (
    <group ref={groupRef}>
      
      {/* The Hanging String (Visual only) - fades out at top */}
      <mesh position={[0, 1.2, -0.1]}>
        <cylinderGeometry args={[0.005, 0.005, 1.5]} />
        <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} transparent opacity={0.6} />
      </mesh>

      {/* Frame Group (Offset slightly so string connects to top center) */}
      <group position={[0, 0, 0]}>
        
        {/* White Paper Backing */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial color="#fdfdfd" roughness={0.8} />
        </mesh>

        {/* The Photo Area */}
        <mesh position={[0, 0.15, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            // Fallback Material (Red for error, Grey for loading)
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>
        
        {/* "Tape" or Gold Clip */}
        <mesh position={[0, 0.7, 0.025]} rotation={[0,0,0]}>
           <boxGeometry args={[0.1, 0.05, 0.05]} />
           <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} />
        </mesh>

        {/* Text Label */}
        <Text
          position={[0, -0.55, 0.03]}
          fontSize={0.12}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {error ? "Image not found" : "Happy Memories"}
        </Text>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({ mode, uploadedPhotos, twoHandsDetected, onClosestPhotoChange }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);

  const photoData = useMemo(() => {
    // Don't render any photos if none are uploaded
    if (uploadedPhotos.length === 0) {
      return [];
    }

    

    const data: PhotoData[] = [];
    const height = 9; // Range of height on tree
    const maxRadius = 5.0; // Slightly outside the foliage radius (which is approx 5 at bottom)
    
    const count = uploadedPhotos.length;

    for (let i = 0; i < count; i++) {
      // 1. Target Position
      // Distributed nicely on the cone surface
      const yNorm = 0.2 + (i / count) * 0.6; // Keep between 20% and 80% height
      const y = yNorm * height;
      
      // Radius decreases as we go up
      const r = maxRadius * (1 - yNorm) + 0.8; // +0.8 to ensure it floats OUTSIDE leaves
      
      // Golden Angle Spiral for even distribution
      const theta = i * 2.39996; // Golden angle in radians
      
      const targetPos = new THREE.Vector3(
        r * Math.cos(theta),
        y,
        r * Math.sin(theta)
      );

      // 2. Chaos Position - Spread out and closer to camera
      // Camera is at [0, 4, 20], Scene group offset is [0, -5, 0]
      // So relative to scene, camera is at y=9
      const relativeY = 5; // Lower position for better visibility
      const relativeZ = 20; // Camera Z
      
      // Create positions spread widely around camera, very close
      const angle = (i / count) * Math.PI * 2; // Distribute evenly
      const distance = 3 + Math.random() * 4; // Distance 3-7 units (very close)
      const heightSpread = (Math.random() - 0.5) * 8; // Height variation -4 to +4 (more spread)
      
      const chaosPos = new THREE.Vector3(
        distance * Math.cos(angle) * 1.2, // X spread wider
        relativeY + heightSpread, // More vertical spread
        relativeZ - 4 + distance * Math.sin(angle) * 0.5 // Very close to camera (Z ~16-19)
      );

      data.push({
        id: i,
        url: uploadedPhotos[i],
        chaosPos,
        targetPos,
        speed: 0.8 + Math.random() * 1.5 // Variable speed
      });

    }

  
    return data;
  }, [uploadedPhotos]);

  // Update closest photo every frame when two hands are detected
  useFrame((state) => {
    if (twoHandsDetected && groupRef.current && photoData.length > 0) {
      // Get camera position in world coordinates
      const cameraPos = state.camera.position.clone();
      
      let minDistance = Infinity;
      let closestIndex = 0;
      
      // Check each photo's actual world position
      groupRef.current.children.forEach((child, i) => {
        if (i < photoData.length) {
          // Get world position of the photo
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          
          const distance = worldPos.distanceTo(cameraPos);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
          }
        }
      });
      
      setClosestPhotoIndex(closestIndex);
      
      // Notify parent component about the closest photo
      if (onClosestPhotoChange) {
        onClosestPhotoChange(uploadedPhotos[closestIndex]);
      }
    } else if (onClosestPhotoChange) {
      // Clear the overlay when two hands are not detected
      onClosestPhotoChange(null);
    }
  });

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => (
        <PolaroidItem 
          key={i} 
          index={i} 
          data={data} 
          mode={mode}
        />
      ))}
    </group>
  );
};
