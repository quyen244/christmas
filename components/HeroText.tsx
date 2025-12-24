import { Text, Billboard } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const HeroText = () => {
  const ref = useRef<any>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 9.5 + Math.sin(clock.elapsedTime) * 0.15;
  });

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <Text
        ref={ref}
        position={[0, 12, 3.5]}
        fontSize={2.2}
        letterSpacing={0.05}
        anchorX="center"
        anchorY="middle"
      >
        LOVE YOU
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.6}
          metalness={0.2}
          roughness={0.1}
        />
      </Text>
    </Billboard>
  );
};
