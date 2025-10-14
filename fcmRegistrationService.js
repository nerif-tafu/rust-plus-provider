// fcmRegistrationService.js - Handles FCM registration with Selenium automation
const { Builder, By, until } = require('selenium-webdriver');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AndroidFCM = require('@liamcottle/push-receiver/src/android/fcm');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

class FcmRegistrationService {
  constructor() {
    this.driver = null;
    this.progressCallback = null;
  }
  
  // Set progress callback for real-time updates
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }
  
  // Send progress update
  sendProgress(step, message, percentage = null) {
    if (this.progressCallback) {
      this.progressCallback({
        step,
        message,
        percentage,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Main method to register with FCM using Steam credentials
  async registerWithSteamCredentials(username, password, twoFactor) {
    try {
      console.log('Starting FCM registration process...');
      this.sendProgress(1, 'Starting FCM registration process...', 0);
      
      // Step 1: Get FCM credentials
      this.sendProgress(1, 'Obtaining FCM credentials...', 10);
      const fcmCredentials = await this.getFcmCredentials();
      console.log('FCM credentials obtained');
      this.sendProgress(1, 'FCM credentials obtained', 20);
      
      // Step 2: Get Expo push token
      this.sendProgress(2, 'Getting Expo push token...', 30);
      const expoPushToken = await this.getExpoPushToken(fcmCredentials.fcm.token);
      console.log('Expo push token obtained');
      this.sendProgress(2, 'Expo push token obtained', 40);
      
      // Step 3: Get Rust+ auth token using Selenium
      this.sendProgress(3, 'Starting Steam login process...', 50);
      const rustplusAuthToken = await this.getRustplusAuthToken(username, password, twoFactor);
      console.log('Rust+ auth token obtained');
      this.sendProgress(3, 'Rust+ auth token obtained', 80);
      
      // Step 4: Register with Rust+ API
      this.sendProgress(4, 'Registering with Rust+ API...', 90);
      await this.registerWithRustPlus(rustplusAuthToken, expoPushToken);
      console.log('Successfully registered with Rust+ API');
      this.sendProgress(4, 'Successfully registered with Rust+ API', 100);
      
      return {
        fcm_credentials: fcmCredentials,
        expo_push_token: expoPushToken,
        rustplus_auth_token: rustplusAuthToken
      };
      
    } catch (error) {
      console.error('FCM registration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  // Helper method to handle alerts that might appear at any time
  async handleAlertIfPresent() {
    try {
      const alert = await this.driver.switchTo().alert();
      const alertText = await alert.getText();
      console.log(`Alert detected: "${alertText}"`);
      await alert.accept();
      console.log('Successfully dismissed alert');
      return true;
    } catch (error) {
      // No alert present
      return false;
    }
  }

  // Gets FCM credentials using the push-receiver library
  async getFcmCredentials() {
    const apiKey = "AIzaSyB5y2y-Tzqb4-I4Qnlsh_9naYv_TD8pCvY";
    const projectId = "rust-companion-app";
    const gcmSenderId = "976529667804";
    const gmsAppId = "1:976529667804:android:d6f1ddeb4403b338fea619";
    const androidPackageName = "com.facepunch.rust.companion";
    const androidPackageCert = "E28D05345FB78A7A1A63D70F4A302DBF426CA5AD";
    
    return await AndroidFCM.register(apiKey, projectId, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert);
  }
  
  // Gets Expo push token
  async getExpoPushToken(fcmToken) {
    const response = await axios.post('https://exp.host/--/api/v2/push/getExpoPushToken', {
      type: 'fcm',
      deviceId: uuidv4(),
      development: false,
      appId: 'com.facepunch.rust.companion',
      deviceToken: fcmToken,
      projectId: "49451aca-a822-41e6-ad59-955718d0ff9c",
    });
    return response.data.data.expoPushToken;
  }
  
  // Gets Rust+ auth token using Selenium automation
  async getRustplusAuthToken(username, password, twoFactor) {
    try {
      this.sendProgress(3, 'Initializing browser...', 50);
      
      // Initialize Chrome driver
      const chrome = require('selenium-webdriver/chrome');
      const options = new chrome.Options();
      options.addArguments('--headless=new');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
      options.addArguments('--disable-web-security');
      options.addArguments('--disable-popup-blocking');
      options.addArguments('--incognito');
      options.addArguments('--disable-extensions');
      
      this.driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
      
      // Set window size as shown in the Selenium test
      await this.driver.manage().window().setRect({ width: 1686, height: 880 });
      
      this.sendProgress(3, 'Navigating to Rust+ login page...', 55);
      // Navigate to Rust+ login page
      await this.driver.get('https://companion-rust.facepunch.com/login');
      
      this.sendProgress(3, 'Clicking Steam login button...', 60);
      // Wait for page to load and click the span element (Steam login button)
      const steamButton = await this.driver.wait(
        until.elementLocated(By.css('span')),
        10000
      );
      await steamButton.click();
      
      this.sendProgress(3, 'Waiting for Steam login page...', 65);
      // Wait for Steam login page to load
      await this.driver.wait(async (driver) => {
        const title = await driver.getTitle();
        return title.includes('Sign In') || title.includes('Steam Community');
      }, 20000, 'Expected either "Sign In" or "Steam Community" in title');
      
      this.sendProgress(3, 'Entering Steam credentials...', 70);
      // Fill in Steam credentials using the correct XPath selectors
      const usernameField = await this.driver.wait(
        until.elementLocated(By.xpath('/html/body/div[1]/div[7]/div[4]/div[1]/div[1]/div/div/div/div[2]/div/form/div[1]/input')),
        50000
      );
      await usernameField.clear();
      await usernameField.sendKeys(username);
      
      const passwordField = await this.driver.wait(
        until.elementLocated(By.xpath('/html/body/div[1]/div[7]/div[4]/div[1]/div[1]/div/div/div/div[2]/div/form/div[2]/input')),
        10000
      );
      await passwordField.clear();
      await passwordField.sendKeys(password);
      
      // Click the sign in button
      const signInButton = await this.driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Sign in")]')),
        50000
      );
      await signInButton.click();
      
      // Check for errors first (before trying to click final sign-in button)
      try {
        // Check for rate limiting error first - look for the "Too Many Retries" text
        const rateLimitElement = await this.driver.wait(
          until.elementLocated(By.xpath("//div[contains(text(), 'Too Many Retries')]")),
          3000
        );
        const rateLimitText = await rateLimitElement.getText();
        if (rateLimitText.includes('Too Many Retries')) {
          throw new Error('Steam rate limiting: Too many sign-in attempts. Please wait and try again later.');
        }
      } catch (rateLimitError) {
        // If rate limiting error found, throw it
        if (rateLimitError.message.includes('Steam rate limiting')) {
          throw rateLimitError;
        }
        
        // If no rate limiting, check for credential errors
        try {
          const credentialErrorElement = await this.driver.wait(
            until.elementLocated(By.xpath('/html/body/div[1]/div[7]/div[4]/div[1]/div[1]/div/div/div/div[2]/div/form/div[5]')),
            2000
          );
          const credentialErrorText = await credentialErrorElement.getText();
          if (credentialErrorText.includes('Please check your password and account name')) {
            throw new Error('Invalid Steam credentials. Please check your username and password.');
          }
        } catch (credentialError) {
          // If credential error found, throw it
          if (credentialError.message.includes('Invalid Steam credentials')) {
            throw credentialError;
          }
        }
      }
      
      // Check if Steam is asking for 2FA BEFORE trying to click final sign-in button
      try {
        // Wait a moment to see if 2FA page appears
        await this.driver.sleep(1000);
        
        // Check if we're on a 2FA page by looking for the "Enter a code instead" element
        const enterCodeElement = await this.driver.wait(
          until.elementLocated(By.xpath("//div[contains(text(), 'Enter a code instead')]")),
          3000
        );
        
        // If we found the 2FA page, handle it
        if (enterCodeElement) {
          console.log('2FA required, handling authentication...');
          this.sendProgress(3, '2FA authentication required...', 75);
          if (twoFactor) {
            await this.handleTwoFactor(twoFactor);
            console.log('2FA completed successfully, continuing with normal flow...');
            this.sendProgress(3, '2FA authentication completed', 80);
          } else {
            throw new Error('Steam account requires 2FA authentication, but no 2FA code was provided. Please provide a 2FA code.');
          }
        }
      } catch (error) {
        // If element is not found within 3 seconds, assume no 2FA required
        if (error.message.includes('Steam account requires 2FA') || error.message.includes('2FA authentication failed') || error.message.includes('Incorrect 2FA code')) {
          throw error; // Re-throw 2FA required errors
        }
        // Otherwise, continue with normal flow (no 2FA required)
        console.log('No 2FA required, continuing with normal flow...');
        
        // Only try to click final sign-in button if no 2FA is required
        try {
          console.log('Looking for final sign-in button...');
          const finalSignInButton = await this.driver.wait(
            until.elementLocated(By.id('imageLogin')),
            10000
          );
          
          // Check if element is visible and enabled before clicking
          const isDisplayed = await finalSignInButton.isDisplayed();
          const isEnabled = await finalSignInButton.isEnabled();
          console.log(`Final sign-in button - Displayed: ${isDisplayed}, Enabled: ${isEnabled}`);
          
          if (isDisplayed && isEnabled) {
            // Scroll into view and click
            await this.driver.executeScript("arguments[0].scrollIntoView(true);", finalSignInButton);
            await this.driver.sleep(500); // Small delay after scroll
            await finalSignInButton.click();
            console.log('Clicked final sign in button');
          } else {
            console.log('Final sign-in button not in valid state for clicking');
          }
        } catch (signInError) {
          console.log('Final sign-in button not found, may have already been clicked or redirected');
        }
      }
      
      // Wait for redirect back to Rust+ and handle any alerts that appear
      // Check if we're already on the Rust+ page (for accounts without 2FA)
      let currentUrl;
      try {
        currentUrl = await this.driver.getCurrentUrl();
        console.log('Current URL after login:', currentUrl);
      } catch (error) {
        // If we get an alert error, handle it and try again
        if (error.message.includes('unexpected alert open')) {
          console.log('Alert detected during URL check, handling...');
          await this.handleAlertIfPresent();
          // Try again after handling alert
          currentUrl = await this.driver.getCurrentUrl();
          console.log('Current URL after alert handling:', currentUrl);
        } else {
          throw error;
        }
      }
      
      if (!currentUrl.includes('companion-rust.facepunch.com')) {
        // Wait for redirect to Rust+ page
        await this.driver.wait(until.urlContains('companion-rust.facepunch.com'), 10000);
      }
      
      // Handle any alerts that might appear
      await this.handleAlertIfPresent();
      
      // Wait for page to load and execute JavaScript
      await this.driver.sleep(5000);
      
      // Handle any alerts that might appear during page load
      await this.handleAlertIfPresent();
      
      // Get the page source with alert handling
      let pageSource;
      let finalUrl;
      try {
        pageSource = await this.driver.getPageSource();
        finalUrl = await this.driver.getCurrentUrl();
        console.log('Final URL before token extraction:', finalUrl);
      } catch (error) {
        // If we get an alert error, handle it and try again
        if (error.message.includes('unexpected alert open')) {
          console.log('Alert detected during page source retrieval, handling...');
          await this.handleAlertIfPresent();
          // Try again after handling alert
          pageSource = await this.driver.getPageSource();
          finalUrl = await this.driver.getCurrentUrl();
          console.log('Final URL after alert handling:', finalUrl);
        } else {
          throw error;
        }
      }
      console.log('Page source length:', pageSource.length);
      
      // Check if we're on the correct page
      if (!finalUrl.includes('companion-rust.facepunch.com')) {
        throw new Error(`Not on Rust+ page. Current URL: ${finalUrl}`);
      }
      
        // Extract token from page source
        if (pageSource.includes('postMessage') && pageSource.includes('Token')) {
          const scriptMatch = pageSource.match(/<script>[\s\S]*?postMessage\('([^']+)'\)[\s\S]*?<\/script>/);
          if (scriptMatch) {
            try {
              // Clean up and parse the JSON string
              let cleanJson = scriptMatch[1].trim().replace(/\\"/g, '"');
              const jsonData = JSON.parse(cleanJson);
              if (jsonData.Token) {
                console.log('Successfully extracted Rust+ auth token');
                return jsonData.Token;
              }
            } catch (e) {
              console.log('Failed to parse JSON from page source:', e);
            }
          }
        }
      
      throw new Error('Could not extract Rust+ auth token');
      
    } catch (error) {
      console.error('Error getting Rust+ auth token:', error);
      throw error;
    }
  }
  
  // Handles 2FA authentication
  async handleTwoFactor(twoFactorCode) {
    try {
      console.log('Looking for "Enter a code instead" element...');
      // Click "Enter a code instead" div
      const enterCodeDiv = await this.driver.wait(
        until.elementLocated(By.xpath("//div[contains(text(), 'Enter a code instead')]")),
        10000
      );
      console.log('Found "Enter a code instead" element, clicking...');
      
      // Try to scroll the element into view first
      await this.driver.executeScript("arguments[0].scrollIntoView(true);", enterCodeDiv);
      await this.driver.sleep(500);
      
      // Try clicking with JavaScript if regular click fails
      try {
        await enterCodeDiv.click();
        console.log('Successfully clicked "Enter a code instead" with regular click');
      } catch (clickError) {
        console.log('Regular click failed, trying JavaScript click...');
        await this.driver.executeScript("arguments[0].click();", enterCodeDiv);
        console.log('Successfully clicked "Enter a code instead" with JavaScript');
      }
      
      // Wait for 2FA input panel to appear
      const twoFactorPanel = await this.driver.wait(
        until.elementLocated(By.xpath('/html/body/div[1]/div[7]/div[4]/div[1]/div[1]/div/div/div/div[2]/form/div/div[2]/div[1]/div')),
        10000
      );
      
      // Get all input fields in the 2FA panel
      const twoFactorFields = await twoFactorPanel.findElements(By.css('input._3xcXqLVteTNHmk-gh9W65d'));
      
      // Clear and fill each field with individual characters
      for (let i = 0; i < twoFactorCode.length && i < twoFactorFields.length; i++) {
        await twoFactorFields[i].clear();
        await twoFactorFields[i].sendKeys(twoFactorCode[i]);
      }
      
      // Click the "Sign in" button
      try {
        console.log('Looking for sign-in button...');
        const signInButton = await this.driver.wait(
          until.elementLocated(By.id('imageLogin')),
          10000
        );
        
        // Check if element is visible and enabled before clicking
        const isDisplayed = await signInButton.isDisplayed();
        const isEnabled = await signInButton.isEnabled();
        console.log(`Sign-in button - Displayed: ${isDisplayed}, Enabled: ${isEnabled}`);
        
        if (!isDisplayed) {
          throw new Error('Sign-in button is not visible');
        }
        if (!isEnabled) {
          throw new Error('Sign-in button is not enabled');
        }
        
        // Scroll into view and click
        await this.driver.executeScript("arguments[0].scrollIntoView(true);", signInButton);
        await this.driver.sleep(500); // Small delay after scroll
        await signInButton.click();
        console.log('Successfully clicked sign-in button');
      } catch (signInError) {
        console.error('Error clicking sign-in button:', signInError.message);
        // If the sign-in button is not found, check if we're still on the 2FA page
        const currentUrl = await this.driver.getCurrentUrl();
        if (currentUrl.includes('steamcommunity.com') && !currentUrl.includes('companion-rust.facepunch.com')) {
          throw new Error('2FA sign-in button not found. The 2FA code may be incorrect or the page structure has changed.');
        }
        // If we've been redirected, continue with normal flow
        console.log('2FA sign-in button not found, but we may have been redirected');
      }
      
      // Wait a moment for any error messages to appear
      await this.driver.sleep(2000);
      
      // Check for incorrect 2FA code error
      try {
        const incorrectCodeElement = await this.driver.wait(
          until.elementLocated(By.xpath('//*[@id="responsive_page_template_content"]/div[1]/div[1]/div/div/div/div[2]/form/div/div[2]/div[1]/div[1]')),
          3000
        );
        const incorrectCodeText = await incorrectCodeElement.getText();
        if (incorrectCodeText.includes('Incorrect code, please try again')) {
          throw new Error('Incorrect 2FA code provided. Please check your authenticator app and try again.');
        }
      } catch (error) {
        // If element is not found within 3 seconds, assume no error
        if (error.message.includes('Incorrect 2FA code')) {
          throw error; // Re-throw 2FA code errors
        }
        // Otherwise, continue with normal flow (no error)
        console.log('No 2FA error detected, continuing...');
      }
      
      // Wait for 2FA to be processed
      await this.driver.sleep(3000);
      
    } catch (error) {
      console.error('Error handling 2FA:', error);
      throw error;
    }
  }
  
  // Registers with Rust+ API
  async registerWithRustPlus(authToken, expoPushToken) {
    return axios.post('https://companion-rust.facepunch.com:443/api/push/register', {
      AuthToken: authToken,
      DeviceId: 'rustplus.js',
      PushKind: 3,
      PushToken: expoPushToken,
    });
  }
  
  // Cleanup Selenium driver
  async cleanup() {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (error) {
        console.error('Error closing driver:', error);
      }
      this.driver = null;
    }
  }
}

module.exports = FcmRegistrationService;
