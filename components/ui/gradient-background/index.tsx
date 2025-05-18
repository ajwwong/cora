import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
}

export function GradientBackground({
  children,
  className = '',
  variant = 'primary',
}: GradientBackgroundProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Gradient colors based on variant and color scheme
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return isDark 
          ? ['#1D1D43', '#2F3F7C', '#3C5991'] // Dark mode navy gradient
          : ['#3C79C9', '#1D1D43']; // Light mode navy gradient
      case 'secondary':
        return isDark 
          ? ['#18185A', '#383999', '#626DE3'] // Dark mode blue gradient
          : ['#9DC7F3', '#7289EA', '#626DE3']; // Light mode blue gradient
      case 'tertiary':
        return isDark 
          ? ['#1E174A', '#4D349F', '#8262DC'] // Dark mode indigo gradient
          : ['#C4B9F7', '#A27EE5', '#8262DC']; // Light mode indigo gradient
      default:
        return isDark 
          ? ['#1D1D43', '#2F3F7C', '#3C5991'] 
          : ['#3C79C9', '#1D1D43'];
    }
  };
  
  return (
    <View style={styles.container} className={className}>
      <LinearGradient
        colors={getColors()}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});