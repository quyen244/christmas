import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GiftBoxProps {
  position?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  ribbonColor?: string;
  isOpen?: boolean; // 👇 Prop mới để điều khiển mở nắp
  childrenBoxes?: {
    offset: [number, number, number];
    size: [number, number, number];
    color?: string;
    ribbonColor?: string;
  }[];
}

// Component ruy băng phụ (cho các hộp con)
const Ribbon: React.FC<{ size: [number, number, number]; color: string }> = ({ size, color }) => {
  const [w, h, d] = size;
  return (
    <>
      <mesh position={[0, 0, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.08, h * 0.9, 0.04]} />
        <meshStandardMaterial color={color} metalness={0.8} />
      </mesh>
      <mesh position={[w / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[w * 0.08, h * 0.9, 0.04]} />
        <meshStandardMaterial color={color} metalness={0.8} />
      </mesh>
    </>
  );
};

export const GiftBox: React.FC<GiftBoxProps> = ({
  position = [0, 0, 0],
  size = [3, 3, 3.2],
  color = "#b11226",
  ribbonColor = "#D4AF37",
  isOpen = false, // Mặc định đóng
  childrenBoxes = [],
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  
  const [width, height, depth] = size;
  const lidHeight = 0.4; // Độ dày nắp
  const bodyHeight = height - lidHeight;

  useFrame((state, delta) => {
    // 1. Hiệu ứng trôi nhẹ cả hộp (Floating)
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.05;
    }

    // 2. Hiệu ứng mở nắp (Opening)
    if (lidRef.current) {
      // Nếu isOpen = true, xoay nắp -110 độ (khoảng -2 rad)
      const targetRotation = isOpen ? -2 : 0;
      lidRef.current.rotation.x = THREE.MathUtils.lerp(
        lidRef.current.rotation.x,
        targetRotation,
        delta * 3
      );
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* --- PHẦN THÂN HỘP (CỐ ĐỊNH) --- */}
      <group position={[0, -lidHeight / 2, 0]}>
        <mesh>
          <boxGeometry args={[width, bodyHeight, depth]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
        </mesh>
        
        {/* Ruy băng thân */}
        <mesh position={[0, 0, depth / 2 + 0.01]}>
          <boxGeometry args={[width * 0.1, bodyHeight, 0.02]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[width / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[width * 0.1, bodyHeight, 0.02]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
      </group>

      {/* --- PHẦN NẮP HỘP (XOAY ĐƯỢC) --- */}
      {/* Pivot point đặt ở cạnh sau trên cùng của thân hộp */}
      <group position={[0, bodyHeight / 2 - lidHeight / 2, -depth / 2]}>
        <group ref={lidRef}>
            {/* Dời hình học nắp ra giữa để tâm xoay nằm đúng cạnh sau */}
            <group position={[0, 0, depth / 2]}>
                
                {/* Hình khối nắp */}
                <mesh position={[0, lidHeight / 2, 0]}>
                    <boxGeometry args={[width + 0.1, lidHeight, depth + 0.1]} />
                    <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
                </mesh>

                {/* Ruy băng nắp (Chữ thập trên nắp) */}
                <mesh position={[0, lidHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[width * 0.1, depth + 0.1]} />
                    <meshStandardMaterial color={ribbonColor} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, lidHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <planeGeometry args={[width * 0.1, width + 0.1]} />
                    <meshStandardMaterial color={ribbonColor} side={THREE.DoubleSide} />
                </mesh>

                {/* Nơ (Bow) gắn trên nắp */}
                <group position={[0, lidHeight + 0.15, 0]}>
                    <mesh>
                        <torusGeometry args={[width * 0.15, width * 0.04, 16, 32]} />
                        <meshStandardMaterial color={ribbonColor} metalness={0.9} />
                    </mesh>
                    <mesh rotation={[0, Math.PI / 4, 0]}>
                        <torusGeometry args={[width * 0.12, width * 0.03, 16, 32]} />
                        <meshStandardMaterial color={ribbonColor} metalness={0.9} />
                    </mesh>
                </group>
            </group>
        </group>
      </group>

      {/* --- CÁC HỘP QUÀ NHỎ XUNG QUANH (GIỮ NGUYÊN) --- */}
      {childrenBoxes.map((box, i) => (
        <group key={i} position={box.offset}>
          <mesh>
            <boxGeometry args={box.size} />
            <meshStandardMaterial
              color={box.color ?? "#146b3a"}
              roughness={0.45}
              metalness={0.15}
            />
          </mesh>
          <Ribbon size={box.size} color={box.ribbonColor ?? ribbonColor} />
        </group>
      ))}
    </group>
  );
};