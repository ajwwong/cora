# RevenueCat Implementation Plan for Cora

This document outlines the implementation plan for integrating RevenueCat's subscription management system into the Cora application.

## Overview

RevenueCat provides a unified API for handling in-app purchases and subscriptions across iOS and Android platforms. It simplifies receipt validation, subscription status tracking, and offers cross-platform purchase restoration.

## Implementation Timeline

Estimated implementation time: 2-3 days

| Task | Time Estimate | Complexity |
|------|---------------|------------|
| Setup & Configuration | 2-3 hours | Low |
| Core Integration | 4-6 hours | Medium |
| UI Implementation | 4-6 hours | Medium |
| Testing | 4-8 hours | High |

## Prerequisites

1. RevenueCat account with API keys
2. Product configuration in App Store Connect and Google Play Console
3. Defined subscription tiers and offerings

## Implementation Steps

### 1. SDK Installation and Configuration

```bash
npm install react-native-purchases --save
```

For iOS, add the following to your Podfile:
```ruby
pod 'PurchasesHybridCommon', '4.x.x'
```

Run pod install:
```bash
cd ios && pod install
```

### 2. Platform-Specific Permissions

#### Android

Add the billing permission to AndroidManifest.xml:
```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

### 3. Initialize RevenueCat SDK

Add initialization code to app startup (in app/_layout.tsx):

```typescript
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// Initialize during app startup
const REVENUE_CAT_API_KEYS = {
  android: 'your_android_api_key',
  ios: 'your_ios_api_key'
};

// In your initialization function
const apiKey = Platform.OS === 'ios' 
  ? REVENUE_CAT_API_KEYS.ios 
  : REVENUE_CAT_API_KEYS.android;

Purchases.configure({
  apiKey,
  appUserID: null, // Will use anonymous ID by default
  observerMode: false, // Set to true if using third-party payment processing
  userDefaultsSuiteName: null // iOS only, defaults to standard user defaults
});
```

### 4. Create Subscription Context

Create a new context file at `contexts/SubscriptionContext.tsx`:

```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

type SubscriptionContextType = {
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[] | null;
  currentSubscription: string | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  checkEntitlementStatus: (entitlementId: string) => boolean;
};

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<string | null>(null);

  useEffect(() => {
    const initPurchases = async () => {
      // Fetch available packages
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current !== null) {
          setPackages(offerings.current.availablePackages);
        }
      } catch (e) {
        console.error('Error fetching packages:', e);
      }

      // Get customer info
      try {
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
        
        // Check subscription status
        const entitlements = info.entitlements.active;
        if (Object.keys(entitlements).length > 0) {
          // User has active subscription
          setCurrentSubscription(Object.keys(entitlements)[0]);
        }
      } catch (e) {
        console.error('Error fetching customer info:', e);
      }
      
      setIsLoading(false);
    };

    initPurchases();
    
    // Set up a listener for purchases
    const purchaseListener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
      
      // Update subscription status
      const entitlements = info.entitlements.active;
      if (Object.keys(entitlements).length > 0) {
        setCurrentSubscription(Object.keys(entitlements)[0]);
      } else {
        setCurrentSubscription(null);
      }
    });
    
    return () => {
      purchaseListener.remove();
    };
  }, []);

  const purchasePackage = async (pkg: PurchasesPackage) => {
    try {
      setIsLoading(true);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(customerInfo);
      
      const entitlements = customerInfo.entitlements.active;
      if (Object.keys(entitlements).length > 0) {
        setCurrentSubscription(Object.keys(entitlements)[0]);
      }
      return true;
    } catch (e: any) {
      if (e.userCancelled) {
        console.log('User cancelled purchase');
      } else {
        console.error('Purchase error:', e);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      
      const entitlements = info.entitlements.active;
      if (Object.keys(entitlements).length > 0) {
        setCurrentSubscription(Object.keys(entitlements)[0]);
      }
      return true;
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  const checkEntitlementStatus = (entitlementId: string): boolean => {
    if (!customerInfo) return false;
    return !!customerInfo.entitlements.active[entitlementId];
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isLoading,
        customerInfo,
        packages,
        currentSubscription,
        purchasePackage,
        restorePurchases,
        checkEntitlementStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
```

### 5. Integration with User Authentication

To link subscriptions with user accounts, update the user authentication flow:

```typescript
// After user signs in
const userId = 'user_id_from_your_auth_system';
await Purchases.logIn(userId);

// When user signs out
await Purchases.logOut();
```

### 6. Create Subscription Screen UI

Create a new component at `components/SubscriptionScreen.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Box, Button, Text, VStack, HStack } from './ui';

const SubscriptionScreen = () => {
  const { 
    isLoading,
    packages,
    currentSubscription,
    purchasePackage,
    restorePurchases 
  } = useSubscription();

  if (isLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" />
      </Box>
    );
  }

  if (currentSubscription) {
    return (
      <Box flex={1} p={4}>
        <VStack space={4} alignItems="center">
          <Text fontSize="xl" fontWeight="bold">
            You're subscribed!
          </Text>
          <Text>
            You have an active subscription to Cora Pro.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box flex={1} p={4}>
      <VStack space={6}>
        <Text fontSize="2xl" fontWeight="bold" textAlign="center">
          Upgrade to Cora Pro
        </Text>
        
        <VStack space={4}>
          {packages?.map((pkg) => (
            <Box 
              key={pkg.identifier} 
              borderWidth={1} 
              borderColor="gray.200" 
              borderRadius="md"
              p={4}
            >
              <VStack space={2}>
                <Text fontSize="lg" fontWeight="bold">
                  {pkg.product.title}
                </Text>
                <Text>{pkg.product.description}</Text>
                <Text fontSize="xl" fontWeight="bold">
                  {pkg.product.priceString}
                </Text>
                <Button 
                  onPress={() => purchasePackage(pkg)}
                  mt={2}
                >
                  Subscribe
                </Button>
              </VStack>
            </Box>
          ))}
        </VStack>
        
        <Button 
          variant="outline" 
          onPress={restorePurchases}
          mt={4}
        >
          Restore Purchases
        </Button>
      </VStack>
    </Box>
  );
};

export default SubscriptionScreen;
```

### 7. Update Root Layout with Provider

Modify `app/_layout.tsx` to include the SubscriptionProvider:

```tsx
import { SubscriptionProvider } from '../contexts/SubscriptionContext';

// In your root component
export default function RootLayout() {
  return (
    <SubscriptionProvider>
      {/* Your existing providers and components */}
    </SubscriptionProvider>
  );
}
```

### 8. Feature-Gate Protected Content

To restrict features based on subscription status:

```tsx
import { useSubscription } from '../contexts/SubscriptionContext';

const FeatureComponent = () => {
  const { checkEntitlementStatus } = useSubscription();
  
  const hasAccess = checkEntitlementStatus('pro_features');
  
  if (!hasAccess) {
    return (
      <Box p={4}>
        <Text>This feature requires a subscription</Text>
        <Button onPress={() => navigate('SubscriptionScreen')}>
          Upgrade Now
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Premium feature content */}
    </Box>
  );
};
```

## Testing

RevenueCat provides sandbox testing capabilities:

1. Use test accounts in App Store Connect and Google Play Console
2. To test iOS sandbox, use a sandbox Apple ID
3. For Android, use test track in Google Play Console

RevenueCat dashboard allows you to:
- View subscription status in real-time
- Test purchases without actual charges
- Verify entitlements are correctly configured

## Production Considerations

Before releasing:

1. Verify API keys are set correctly for production
2. Test full purchase flow in staging/testflight
3. Verify receipt validation works properly
4. Test subscription renewal logic
5. Test restore purchases functionality
6. Verify cancellation handling

## Best Practices

1. **Error Handling**: Always handle purchase errors gracefully
2. **Offline Support**: Check subscription status locally when possible
3. **Analytics**: Track conversion rates and subscription events
4. **Receipt Validation**: Let RevenueCat handle all receipt validation
5. **User Experience**: Show appropriate loading states during purchases
6. **Restore Purchases**: Always provide a visible way to restore purchases

## RevenueCat Dashboard Configuration

Set up in the RevenueCat dashboard:
1. Create products that match App Store/Play Store configurations
2. Set up entitlements that reflect feature access levels
3. Configure offerings to group product packages logically
4. Set up subscriber attributes for user segmentation (optional)

## Additional Resources

- [RevenueCat React Native SDK Documentation](https://docs.revenuecat.com/docs/reactnative)
- [Testing In-App Purchases](https://docs.revenuecat.com/docs/testing)
- [Subscription Status Tracking](https://docs.revenuecat.com/docs/subscription-status)
- [User Management](https://docs.revenuecat.com/docs/user-management)