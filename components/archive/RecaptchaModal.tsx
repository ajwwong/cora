import React, { useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { Button, ButtonText } from "../ui/button";
import { Text } from "../ui/text";

// Google reCAPTCHA v3 site key
const RECAPTCHA_SITE_KEY = "6LdyXaoqAAAAAP2G7TLmZGo6NTzzGhE7eqN6UPqV";

// HTML content for reCAPTCHA v3
const generateRecaptchaHtml = (siteKey: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>reCAPTCHA</title>
  <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}"></script>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    #container {
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h3 {
      margin-bottom: 20px;
      color: #333;
    }
    p {
      color: #555;
      margin-bottom: 20px;
    }
    .spinner {
      border: 4px solid rgba(0, 0, 0, 0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: #4285F4;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .status {
      margin-top: 20px;
      padding: 10px;
      border-radius: 4px;
    }
    .success {
      background-color: #d4edda;
      color: #155724;
    }
    .error {
      background-color: #f8d7da;
      color: #721c24;
    }
    .grecaptcha-badge {
      visibility: visible !important;
    }
  </style>
</head>
<body>
  <div id="container">
    <h3>Human Verification</h3>
    <p>We're verifying that you're not a robot...</p>
    <div class="spinner" id="loading-spinner"></div>
    <div id="status-message" class="status"></div>
  </div>
  
  <script>
    // Debug: Log the current origin/domain
    console.log('Current origin:', window.location.origin);
    console.log('Current hostname:', window.location.hostname);
    console.log('Current href:', window.location.href);

    // Send domain info back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      event: 'DOMAIN_INFO',
      origin: window.location.origin,
      hostname: window.location.hostname,
      href: window.location.href
    }));

    // Try to execute reCAPTCHA as soon as it's ready
    window.onload = function() {
      try {
        grecaptcha.ready(function() {
          // Execute reCAPTCHA with action
          grecaptcha.execute('${siteKey}', {action: 'register'})
            .then(function(token) {
              // Show success message
              document.getElementById('loading-spinner').style.display = 'none';
              document.getElementById('status-message').textContent = 'Verification successful!';
              document.getElementById('status-message').className = 'status success';
              
              // Send token back to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'RECAPTCHA_SUCCESS',
                token: token
              }));
            })
            .catch(function(error) {
              // Handle error
              document.getElementById('loading-spinner').style.display = 'none';
              document.getElementById('status-message').textContent = 'Verification failed. Please try again.';
              document.getElementById('status-message').className = 'status error';
              
              console.error('reCAPTCHA error:', error);
              
              // Send error back to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'RECAPTCHA_ERROR',
                error: error.toString()
              }));
            });
        });
      } catch (error) {
        // Handle unexpected errors
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('status-message').textContent = 'An error occurred with verification. Please try again later.';
        document.getElementById('status-message').className = 'status error';
        
        console.error('Unexpected reCAPTCHA error:', error);
        
        // Send error back to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          event: 'RECAPTCHA_ERROR',
          error: error.toString()
        }));
      }
    };
  </script>
</body>
</html>
`;

interface RecaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
}

const RecaptchaModal: React.FC<RecaptchaModalProps> = ({ visible, onClose, onVerify, onError }) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.event === "DOMAIN_INFO") {
        console.log("WebView domain info:", {
          origin: data.origin,
          hostname: data.hostname,
          href: data.href,
        });
        console.log("=======================================================");
        console.log("ADD THESE DOMAINS TO YOUR RECAPTCHA CONFIGURATION:");
        console.log(data.hostname || "null");
        console.log(data.origin ? new URL(data.origin).hostname : "null");
        console.log("=======================================================");
      } else if (data.event === "RECAPTCHA_SUCCESS" && data.token) {
        console.log("reCAPTCHA verification successful");
        onVerify(data.token);
        setTimeout(() => onClose(), 1500); // Close after showing success message briefly
      } else if (data.event === "RECAPTCHA_ERROR") {
        console.error("reCAPTCHA verification error:", data.error);
        if (onError) {
          onError(data.error);
        }
      }
    } catch (error) {
      console.error("Error parsing message from WebView:", error);
    }
  };

  const handleWebViewLoad = () => {
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Loading verification...</Text>
            </View>
          )}

          <WebView
            ref={webViewRef}
            source={{ html: generateRecaptchaHtml(RECAPTCHA_SITE_KEY) }}
            onMessage={handleMessage}
            onLoad={handleWebViewLoad}
            style={[styles.webView, loading ? styles.hidden : undefined]}
            originWhitelist={["*"]}
            javaScriptEnabled={true}
            startInLoadingState={true}
            onNavigationStateChange={(navState) => {
              console.log("WebView navigated to:", navState.url);
            }}
          />

          <Button variant="outline" onPress={onClose} style={styles.closeButton}>
            <ButtonText>Cancel</ButtonText>
          </Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: "90%",
    height: 400,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    width: "100%",
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
  },
  closeButton: {
    marginTop: 10,
  },
});

export default RecaptchaModal;
