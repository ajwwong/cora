import { Stack } from "expo-router";
import React from "react";

import SubscriptionScreen from "../../components/SubscriptionScreen";

/**
 * Subscription screen route
 * Accessible via /subscription
 */
export default function Subscription() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Subscription",
          headerShown: true,
        }}
      />
      <SubscriptionScreen />
    </>
  );
}
